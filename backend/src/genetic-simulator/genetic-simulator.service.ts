import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { Stage } from '@prisma/client';
import { SingleEliminationStrategy } from './strategies/single-elimination.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { StatsService } from 'src/stats/stats.service';
import { SimulationContextBuilder } from './simulation-context.builder';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StrategyResult } from './genetic-simulator.types';

@Injectable()
export class GeneticSimulatorService {
  constructor(
    private prisma: PrismaService,
    private matchSimulator: SimulatorFactoryService,
    private statsService: StatsService,
    private simulationContextBuilder: SimulationContextBuilder,
    private accessPolicy: AccessPolicyService,
    // Інжектимо стратегії:
    private singleEliminationStrategy: SingleEliminationStrategy,
    private groupStageStrategy: GroupStageStrategy,
    private doubleEliminationStrategy: DoubleEliminationStrategy,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Головні методи запуску
  async runSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const targetStage = Stage.PLAYOFF;
    const context =
      await this.simulationContextBuilder.prepareSimulationContext(
        dto.tournamentId,
        targetStage,
        user,
      );

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    const targetStageMatches = context.baseSkeleton;

    const isDryRun = dto.isDryRun ?? true;

    // Блокуємо COMMIT-симуляцію, якщо турнір вже грається людьми
    if (!isDryRun) {
      this.accessPolicy.checkTournamentCreatorOrAdmin(
        tournament.creatorId,
        user,
      );

      await this.cacheManager.del(`/matches/tournament/${dto.tournamentId}`);
      await this.cacheManager.del(`/tournaments/${dto.tournamentId}`);
      await this.cacheManager.del('/tournaments/workflow?workflow=generation');
      await this.cacheManager.del('/tournaments/workflow?workflow=simulation');

      const hasManualMatches = await this.prisma.match.findFirst({
        where: {
          tournamentId: dto.tournamentId,
          stage: targetStage,
          isProcessed: true,
        },
      });
      if (hasManualMatches) {
        throw new BadRequestException(
          'Турнір вже містить зіграні матчі. Перезапис неможливий. Використовуйте режим прогнозу.',
        );
      }
    }

    const bracketType = context.tournament.settings?.bracketType;
    const isDoubleElim =
      targetStageMatches.some((m) => m.bracket === 'LOWER') ||
      bracketType === 'DOUBLE_ELIMINATION';

    // Логіка вибору стратегії на основі налаштувань турніру
    let result: StrategyResult;

    if (isDoubleElim) {
      result = await this.doubleEliminationStrategy.execute(
        context,
        dto.populations,
        isDryRun,
      );
    } else {
      result = await this.singleEliminationStrategy.execute(
        context,
        dto.populations,
        isDryRun,
      );
    }
    // Після того, як турнір отримав статус 'finished'
    // ми одразу викликаємо наш сервіс для урахування статистики та оновлення Elo рейтингу
    // Рахуємо статистику ТІЛЬКИ якщо ми закоммітили результати в БD
    if (!isDryRun) {
      await this.statsService.processTournamentStats(dto.tournamentId, user);
    }

    return {
      ...result,
      statsMessage: isDryRun
        ? 'Аналітичний прогноз збережено. Стан турніру не змінено.'
        : 'Статистику гравців та рейтинги Elo успішно перераховано!',
    };
  }

  async runGroupSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const targetStage = dto.stage || Stage.GROUP;
    const context =
      await this.simulationContextBuilder.prepareSimulationContext(
        dto.tournamentId,
        targetStage,
        user,
      );

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    const isDryRun = dto.isDryRun ?? true;

    if (!isDryRun) {
      this.accessPolicy.checkTournamentCreatorOrAdmin(
        tournament.creatorId,
        user,
      );

      const hasManualMatches = await this.prisma.match.findFirst({
        where: {
          tournamentId: dto.tournamentId,
          stage: targetStage,
          isProcessed: true,
        },
      });
      if (hasManualMatches) {
        throw new BadRequestException(
          'В групах вже є зіграні матчі. Використовуйте режим прогнозу.',
        );
      }
    }

    await this.cacheManager.del(`/matches/tournament/${dto.tournamentId}`);
    await this.cacheManager.del(`/tournaments/${dto.tournamentId}`);
    await this.cacheManager.del('/tournaments/workflow?workflow=generation');
    await this.cacheManager.del('/tournaments/workflow?workflow=simulation');

    const result = await this.groupStageStrategy.execute(
      context,
      dto.populations,
      isDryRun,
    );

    if (!isDryRun) {
      await this.statsService.processTournamentStats(dto.tournamentId, user);
    }

    return {
      ...result,
      statsMessage: isDryRun
        ? 'Аналітичний прогноз груп збережено.'
        : 'Результати груп та Elo гравців успішно оновлено.',
    };
  }

  async findRunsByTournament(tournamentId: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, creatorId: true },
    });

    if (!tournament) {
      throw new NotFoundException('Турнір не знайдено');
    }

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    return this.prisma.simulationRun.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
