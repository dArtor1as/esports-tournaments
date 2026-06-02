import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';
import type { TournamentStatus, WorkflowMode } from './tournaments.types';
import { TournamentsWorkflowLogic } from './tournaments-workflow.logic';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class TournamentsWorkflowService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async generateTestTournament(dto: GenerateTestTournamentDto, userId: string) {
    // 1. Отримуємо гру
    const game = dto.gameId
      ? await this.prisma.game.findUnique({ where: { id: dto.gameId } })
      : await this.prisma.game.findUnique({ where: { slug: 'cs2' } });

    if (!game) throw new BadRequestException('Гру не знайдено.');

    // 2. Витягуємо команди одразу з гравцями
    const availableTeams = await this.prisma.team.findMany({
      where: { gameId: game.id, isComplete: true },
      include: { players: true },
    });

    // 3. Формуємо payload через Білдер
    const payload = TournamentsWorkflowLogic.buildTestTournamentPayload(
      dto,
      userId,
      game.id,
      availableTeams,
    );

    // 4. Prisma автоматично зберігає ВСЕ (Турнір + Учасників + Ростери) в одній транзакції
    const tournament = await this.prisma.tournament.create({
      data: payload,
    });

    // Очищаємо кеш після створення тестового турніру
    await this.cacheManager.del('/tournaments/workflow');
    await this.cacheManager.del('/tournaments/workflow?workflow=generation');
    await this.cacheManager.del('/tournaments/workflow?workflow=simulation');
    await this.cacheManager.del('/tournaments');

    return {
      message: `Турнір '${payload.title}' на '${payload.maxParticipants}' команд успішно створено.`,
      tournamentId: tournament.id,
      format: dto.bracketType || 'SINGLE_ELIMINATION',
      participantsCount: payload.maxParticipants,
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

    const where = normalizedStatus ? { status: normalizedStatus } : {};

    // 1. Дістаємо турніри
    const tournaments = await this.prisma.tournament.findMany({
      where,
      include: {
        game: { select: { name: true } },
        _count: { select: { participants: true, matches: true } },
      },
      orderBy: { id: 'desc' },
    });

    // 2. Дістаємо статистику матчів
    const tournamentIds = tournaments.map((t) => t.id);
    const stageCounts =
      tournamentIds.length > 0
        ? await this.prisma.match.groupBy({
            by: ['tournamentId', 'stage'],
            where: { tournamentId: { in: tournamentIds } },
            _count: { _all: true },
          })
        : [];
    // Рахуємо тільки реально завершені (зіграні) матчі
    const playedCounts =
      tournamentIds.length > 0
        ? await this.prisma.match.groupBy({
            by: ['tournamentId'],
            where: {
              tournamentId: { in: tournamentIds },
              matchStatus: 'COMPLETED',
            },
            _count: { _all: true },
          })
        : [];

    // 3. Делегуємо мапінг у чисту функцію
    return TournamentsWorkflowLogic.formatWorkflowView(
      tournaments,
      stageCounts,
      playedCounts,
      workflow as WorkflowMode,
    );
  }
}
