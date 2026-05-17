import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Stage, TournamentFormat, RosterRole } from '@prisma/client';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { TournamentStatus, WorkflowMode } from './tournaments.types'; // Винесемо типи окремо

@Injectable()
export class TournamentsWorkflowService {
  constructor(private prisma: PrismaService) {}

  async generateTestTournament(dto: GenerateTestTournamentDto, userId: string) {
    const teamCount = dto.teamCount || 16;
    const bracketType = dto.bracketType || 'SINGLE_ELIMINATION';
    const title =
      dto.title || `Custom Cup #${Math.floor(Math.random() * 1000)}`;

    const allowedCounts = [4, 8, 16, 32];
    if (!allowedCounts.includes(teamCount)) {
      throw new BadRequestException('teamCount має бути 4, 8, 16 або 32');
    }

    const tournamentTier = dto.tier || 3; // За замовчуванням робимо Tier 3
    let kFactor = 1.0; // Для Tier 1
    if (tournamentTier === 2) kFactor = 0.6;
    if (tournamentTier === 3) kFactor = 0.3;

    let game;
    if (dto.gameId) {
      game = await this.prisma.game.findUnique({ where: { id: dto.gameId } });
    } else {
      game = await this.prisma.game.findUnique({ where: { slug: 'cs2' } }); // фолбек
    }

    if (!game) {
      throw new BadRequestException('Гру не знайдено.');
    }
    //  Витягуємо команди одразу з гравцями, щоб сформувати ростер
    const availableTeams = await this.prisma.team.findMany({
      where: {
        gameId: game.id,
        isComplete: true, // Беремо тільки укомплектовані команди
      },
      include: { players: true },
    });

    if (availableTeams.length < teamCount) {
      throw new BadRequestException(
        `У базі лише ${availableTeams.length} команд.`,
      );
    }

    // Перемішуємо команди, щоб турніри завжди були різними
    const shuffled = [...availableTeams].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, teamCount);

    const tournament = await this.prisma.$transaction(async (prismaTx) => {
      const createdTournament = await prismaTx.tournament.create({
        data: {
          title: title,
          gameId: game.id,
          tier: tournamentTier,
          region: dto.region || 'GLOBAL',
          kFactor: kFactor,
          format: TournamentFormat.TEAM,
          maxParticipants: teamCount,
          // Передаємо налаштування з фронтенду!
          settings: {
            pointsForWin: 3,
            tiebreakers: ['h2h', 'mapDiff'],
            bracketType: bracketType,
          },
          status: 'planned',
          creatorId: userId,
          isPublic: true,
        },
      });
      // Cтворюємо і учасника, і його ростер
      for (let i = 0; i < selected.length; i++) {
        const team = selected[i];
        // 1. Реєструємо команду на турнір
        const participant = await prismaTx.tournamentParticipant.create({
          data: {
            tournamentId: createdTournament.id,
            teamId: team.id,
            joinedStage: Stage.PLAYOFF,
            seed: i + 1,
          },
        });

        // 2. Автоматично заявляємо всіх гравців цієї команди в TournamentRoster (тільки для тестів!)
        const rosterData = team.players.map((player) => ({
          participantId: participant.id,
          playerId: player.id,
          role:
            player.inGameRole === 'COACH'
              ? RosterRole.COACH
              : RosterRole.PLAYER,
        }));

        await prismaTx.tournamentRoster.createMany({
          data: rosterData,
        });
      }

      return createdTournament;
    });

    return {
      message: `Турнір '${title}' на '${teamCount}' команд успішно створено.`,
      tournamentId: tournament.id,
      format: bracketType,
      participantsCount: teamCount,
    };
  }

  async findWorkflow(workflow?: string, status?: string) {
    const allowedWorkflows: WorkflowMode[] = ['generation', 'simulation'];
    const allowedStatuses: TournamentStatus[] = [
      'planned',
      'live',
      'finished',
      'cancelled',
    ];

    if (workflow && !allowedWorkflows.includes(workflow as WorkflowMode)) {
      throw new BadRequestException('Невірний параметр workflow.');
    }

    const normalizedStatus = status?.toLowerCase();
    if (
      normalizedStatus &&
      !allowedStatuses.includes(normalizedStatus as TournamentStatus)
    ) {
      throw new BadRequestException('Невірний параметр status.');
    }

    const where: Prisma.TournamentWhereInput = {};
    if (normalizedStatus) where.status = normalizedStatus;

    const tournaments = await this.prisma.tournament.findMany({
      where,
      include: {
        game: { select: { name: true } },
        _count: { select: { participants: true, matches: true } },
      },
      orderBy: { id: 'desc' },
    });

    const tournamentIds = tournaments.map((t) => t.id);
    const stageCounts =
      tournamentIds.length > 0
        ? await this.prisma.match.groupBy({
            by: ['tournamentId', 'stage'],
            where: { tournamentId: { in: tournamentIds } },
            _count: { _all: true },
          })
        : [];

    const countsMap = new Map<
      string,
      { groupMatches: number; playoffMatches: number }
    >();
    for (const row of stageCounts) {
      const existing = countsMap.get(row.tournamentId) ?? {
        groupMatches: 0,
        playoffMatches: 0,
      };
      if (row.stage === Stage.GROUP) existing.groupMatches = row._count._all;
      if (row.stage === Stage.PLAYOFF)
        existing.playoffMatches = row._count._all;
      countsMap.set(row.tournamentId, existing);
    }

    const workflowView = tournaments.map((tournament) => {
      const matches = countsMap.get(tournament.id) ?? {
        groupMatches: 0,
        playoffMatches: 0,
      };
      const hasGeneratedGrid =
        matches.groupMatches + matches.playoffMatches > 0;

      return {
        id: tournament.id,
        title: tournament.title,
        status: tournament.status,
        format: tournament.format,
        gameName: tournament.game.name,
        participantsCount: tournament._count.participants,
        totalMatches: tournament._count.matches,
        groupMatches: matches.groupMatches,
        playoffMatches: matches.playoffMatches,
        canGenerateBracket:
          tournament.status === 'planned' ||
          (matches.groupMatches > 0 && matches.playoffMatches === 0),
        hasGeneratedGrid,
        requiresTransitionToPlayoffs:
          matches.groupMatches > 0 && matches.playoffMatches === 0,
      };
    });

    if (workflow === 'generation')
      return workflowView.filter((t) => t.canGenerateBracket);
    if (workflow === 'simulation')
      return workflowView.filter((t) => t.hasGeneratedGrid);

    return workflowView;
  }
}
