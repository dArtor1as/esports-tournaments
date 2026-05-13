import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Region,
  Stage,
  TournamentFormat,
  RosterRole,
} from '@prisma/client';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

type WorkflowMode = 'generation' | 'simulation';
type TournamentStatus = 'planned' | 'live' | 'finished';

@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async generateTestTournament(dto: GenerateTestTournamentDto, userId: string) {
    const teamCount = dto.teamCount || 16;
    const bracketType = dto.bracketType || 'SINGLE_ELIMINATION';
    const title =
      dto.title || `Custom Cup #${Math.floor(Math.random() * 1000)}`;

    const allowedCounts = [4, 8, 16, 32];
    if (!allowedCounts.includes(teamCount)) {
      throw new BadRequestException('teamCount має бути 4, 8, 16 або 32');
    }

    const game = await this.prisma.game.findUnique({
      where: { slug: 'cs2' },
    });
    if (!game) {
      throw new BadRequestException('Гру CS2 не знайдено. Запустіть seed.');
    }
    //  Витягуємо команди одразу з гравцями, щоб сформувати ростер
    const availableTeams = await this.prisma.team.findMany({
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
          tier: 1,
          region: Region.GLOBAL,
          kFactor: 1.0,
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

  async create(createTournamentDto: CreateTournamentDto, userId: string) {
    // Перевіряємо, чи існує така гра в базі
    const game = await this.prisma.game.findUnique({
      where: { id: createTournamentDto.gameId },
    });

    if (!game) {
      throw new NotFoundException('Дисципліна (гра) не знайдена');
    }

    // Створюємо турнір. Статус 'planned' ставиться автоматично завдяки @default в схемі
    const createdTournament = await this.prisma.tournament.create({
      data: {
        title: createTournamentDto.title,
        gameId: createTournamentDto.gameId,
        tier: createTournamentDto.tier,
        region: createTournamentDto.region,
        kFactor: createTournamentDto.kFactor,
        format: createTournamentDto.format || 'TEAM',
        maxParticipants: createTournamentDto.maxParticipants || 16,
        settings: createTournamentDto.settings
          ? (createTournamentDto.settings as Prisma.InputJsonValue)
          : Prisma.JsonNull, // JSON-поля
        creatorId: userId,
        isPublic: createTournamentDto.isPublic,
      },
    });
    await this.cacheManager.del('all_tournaments'); // Очищаємо кеш при створенні нового турніру

    return createdTournament;
  }

  findAll() {
    return this.prisma.tournament.findMany({
      include: {
        game: { select: { name: true } },
        _count: { select: { participants: true } }, // одразу рахуємо кількість учасників
      },
      orderBy: { id: 'desc' },
    });
  }

  async findWorkflow(workflow?: string, status?: string) {
    const allowedWorkflows: WorkflowMode[] = ['generation', 'simulation'];
    const allowedStatuses: TournamentStatus[] = ['planned', 'live', 'finished'];

    if (workflow && !allowedWorkflows.includes(workflow as WorkflowMode)) {
      throw new BadRequestException(
        'Невірний параметр workflow. Допустимі значення: generation, simulation',
      );
    }

    const normalizedStatus = status?.toLowerCase();
    if (
      normalizedStatus &&
      !allowedStatuses.includes(normalizedStatus as TournamentStatus)
    ) {
      throw new BadRequestException(
        'Невірний параметр status. Допустимі значення: planned, live, finished',
      );
    }

    const where: Prisma.TournamentWhereInput = {};
    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    const tournaments = await this.prisma.tournament.findMany({
      where,
      include: {
        game: { select: { name: true } },
        _count: { select: { participants: true, matches: true } },
      },
      orderBy: { id: 'desc' },
    });

    const tournamentIds = tournaments.map((tournament) => tournament.id);
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

      if (row.stage === Stage.GROUP) {
        existing.groupMatches = row._count._all;
      }
      if (row.stage === Stage.PLAYOFF) {
        existing.playoffMatches = row._count._all;
      }

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

    if (workflow === 'generation') {
      return workflowView.filter((tournament) => tournament.canGenerateBracket);
    }

    if (workflow === 'simulation') {
      return workflowView.filter((tournament) => tournament.hasGeneratedGrid);
    }

    return workflowView;
  }

  async findMyTournaments(userId: string) {
    return this.prisma.tournament.findMany({
      where: { creatorId: userId },
      include: {
        game: { select: { name: true } },
        _count: { select: { participants: true, matches: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.tournament.findUnique({
      where: { id },
      include: {
        game: true,
        participants: {
          include: { team: true }, // Показуємо, які команди вже зареєстровані
        },
      },
    });
  }

  async update(
    id: string,
    updateTournamentDto: UpdateTournamentDto,
    user: JwtPayload,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    if (tournament.creatorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Ви не маєте прав на редагування цього турніру',
      );
    }

    // Захист: якщо турнір вже йде або завершився, забороняємо міняти ключові формати
    if (
      tournament.status !== 'planned' &&
      (updateTournamentDto.format || updateTournamentDto.gameId)
    ) {
      throw new BadRequestException(
        'Неможливо змінити формат або гру після старту турніру',
      );
    }

    const updatedTournament = await this.prisma.tournament.update({
      where: { id },
      data: updateTournamentDto as unknown as Prisma.TournamentUpdateInput,
    });

    await this.cacheManager.del('all_tournaments'); // Очищаємо кеш при оновленні турніру

    return updatedTournament;
  }

  async remove(id: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: { matches: true },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    if (tournament.creatorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Ви не маєте прав на видалення цього турніру',
      );
    }

    // Безпечне видалення: дозволяємо видаляти тільки якщо немає згенерованих матчів
    if (tournament.matches.length > 0) {
      throw new BadRequestException(
        'Неможливо видалити турнір, в якому вже є матчі. Змініть статус на cancelled.',
      );
    }

    const deletedTournament = await this.prisma.tournament.delete({
      where: { id },
    });

    await this.cacheManager.del('all_tournaments'); // Очищаємо кеш при видаленні турніру

    return deletedTournament;
  }
}
