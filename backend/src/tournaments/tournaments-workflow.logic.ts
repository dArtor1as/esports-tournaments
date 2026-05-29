import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  Stage,
  TournamentFormat,
  RosterRole,
  Tournament,
  Team,
  Player,
} from '@prisma/client';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';
import type { WorkflowMode } from './tournaments.types';

export type TeamWithPlayers = Team & { players: Player[] };

export type TournamentWorkflowView = Tournament & {
  game: { name: string };
  _count: { participants: number; matches: number };
};

export type StageCountResult = {
  tournamentId: string;
  stage: Stage;
  _count: { _all: number };
};

export class TournamentsWorkflowLogic {
  // 1. Білдер: Формує гігантський об'єкт для збереження турніру за 1 запит
  static buildTestTournamentPayload(
    dto: GenerateTestTournamentDto,
    userId: string,
    gameId: string,
    availableTeams: TeamWithPlayers[], // Масив команд разом із гравцями
  ): Prisma.TournamentCreateInput {
    const teamCount = dto.teamCount || 16;
    const bracketType = dto.bracketType || 'SINGLE_ELIMINATION';
    const title =
      dto.title || `Custom Cup #${Math.floor(Math.random() * 1000)}`;

    const allowedCounts = [4, 8, 16, 32];
    if (!allowedCounts.includes(teamCount)) {
      throw new BadRequestException('teamCount має бути 4, 8, 16 або 32');
    }

    if (availableTeams.length < teamCount) {
      throw new BadRequestException(
        `У базі лише ${availableTeams.length} укомплектованих команд (потрібно ${teamCount}).`,
      );
    }

    const tournamentTier = dto.tier || 3;
    const kFactor =
      tournamentTier === 1 ? 1.0 : tournamentTier === 2 ? 0.6 : 0.3;

    // Перемішуємо команди
    const shuffled = [...availableTeams].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, teamCount);

    // Вкладене створення турніру з командами та гравцями
    return {
      title,
      tier: tournamentTier,
      region: dto.region || 'GLOBAL',
      kFactor,
      format: TournamentFormat.TEAM,
      maxParticipants: teamCount,
      status: 'planned',
      isPublic: dto.isPublic,
      settings: {
        pointsForWin: 3,
        tiebreakers: ['h2h', 'mapDiff'],
        bracketType,
        ...(String(bracketType) === 'ROUND_ROBIN' && {
          groupCount: dto.groupCount || 2,
        }),
      },
      game: { connect: { id: gameId } },
      creator: { connect: { id: userId } },

      // Вкладені масиви (Prisma сама створить транзакцію)
      participants: {
        create: selected.map((team, index) => ({
          team: { connect: { id: team.id } },
          joinedStage: Stage.PLAYOFF,
          seed: index + 1,
          tournamentRosters: {
            create: team.players.map((player) => {
              // ЯВНО вказуємо тип : RosterRole
              let mappedRole: RosterRole = RosterRole.PLAYER;

              // Повертаємо безпечну перевірку зі старого коду
              if (String(player.teamRole) === String(RosterRole.CAPTAIN))
                mappedRole = RosterRole.CAPTAIN;
              if (String(player.teamRole) === String(RosterRole.COACH))
                mappedRole = RosterRole.COACH;
              if (String(player.teamRole) === String(RosterRole.SUBSTITUTE))
                mappedRole = RosterRole.SUBSTITUTE;

              return {
                player: { connect: { id: player.id } },
                role: mappedRole,
              };
            }),
          },
        })),
      },
    };
  }

  // 2. Форматування даних для адмін-панелі Workflow
  static formatWorkflowView(
    tournaments: TournamentWorkflowView[],
    stageCounts: StageCountResult[],
    workflow?: WorkflowMode,
  ) {
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
