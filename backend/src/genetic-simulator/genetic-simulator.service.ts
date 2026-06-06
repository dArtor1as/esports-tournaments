import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
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
import { GeneticSimulatorPersistence } from './genetic-simulator.persistence';

@Injectable()
export class GeneticSimulatorService {
  constructor(
    private prisma: PrismaService,
    private statsService: StatsService,
    private simulationContextBuilder: SimulationContextBuilder,
    private accessPolicy: AccessPolicyService,
    private singleEliminationStrategy: SingleEliminationStrategy,
    private groupStageStrategy: GroupStageStrategy,
    private doubleEliminationStrategy: DoubleEliminationStrategy,
    private persistence: GeneticSimulatorPersistence,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async runSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const targetStage = dto.stage || Stage.PLAYOFF;

    // 1. Отримуємо контекст
    const context =
      await this.simulationContextBuilder.prepareSimulationContext(
        dto.tournamentId,
        targetStage,
        user,
      );

    const isDryRun = dto.isDryRun ?? true;
    const generations = dto.generations || 20;

    // 2. Валідація та кеш (Оркестрація Side-effects)
    if (!isDryRun) {
      this.accessPolicy.checkTournamentCreatorOrAdmin(
        context.tournament.creatorId as string,
        user,
      );
      await this.checkManualMatchesCollision(dto.tournamentId, targetStage);
    }

    const bracketType = context.tournament.settings?.bracketType;
    const isDoubleElim =
      context.baseSkeleton.some((m) => m.bracket === 'LOWER') ||
      bracketType === 'DOUBLE_ELIMINATION';

    // 3. ВИКЛИКАЄМО ЧИСТУ СТРАТЕГІЮ
    const result: StrategyResult = isDoubleElim
      ? this.doubleEliminationStrategy.execute(
          context,
          dto.populations,
          generations,
        )
      : this.singleEliminationStrategy.execute(
          context,
          dto.populations,
          generations,
        );

    // 4. ДЕЛЕГУЄМО ЗБЕРЕЖЕННЯ (Persistence)
    if (isDryRun) {
      await this.persistence.saveDryRun(
        dto.tournamentId,
        dto.populations,
        result,
      );
    } else {
      await this.persistence.commitPlayoffResults(
        dto.tournamentId,
        dto.populations,
        result,
      );
      await this.statsService.processTournamentStats(dto.tournamentId, user);

      await this.clearSimulationCaches(dto.tournamentId);
    }

    return {
      algorithmType: result.algorithmType,
      bestFitnessScore: result.bestFitnessScore,
      bracket: result.bracket,
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

    const isDryRun = dto.isDryRun ?? true;
    const generations = dto.generations || 20;

    // 1. Валідація та кеш
    if (!isDryRun) {
      this.accessPolicy.checkTournamentCreatorOrAdmin(
        context.tournament.creatorId as string,
        user,
      );
      await this.checkManualMatchesCollision(dto.tournamentId, targetStage);
    }

    // 2. ВИКЛИКАЄМО СТРАТЕГІЮ ROUND ROBIN (ГРУПОВИЙ ЕТАП)
    const result: StrategyResult = this.groupStageStrategy.execute(
      context,
      dto.populations,
      generations,
    );

    // 3. ДЕЛЕГУЄМО ЗБЕРЕЖЕННЯ
    if (isDryRun) {
      await this.persistence.saveDryRun(
        dto.tournamentId,
        dto.populations,
        result,
      );
    } else {
      await this.persistence.commitGroupResults(
        dto.tournamentId,
        dto.populations,
        context.tournament.participants,
        result,
      );
      await this.statsService.processTournamentStats(dto.tournamentId, user);
      await this.clearSimulationCaches(dto.tournamentId);
    }

    return {
      algorithmType: result.algorithmType,
      bestFitnessScore: result.bestFitnessScore,
      bracket: result.bracket,
      standings: result.standings,
      statsMessage: isDryRun
        ? 'Аналітичний прогноз груп збережено.'
        : 'Результати груп та Elo гравців успішно оновлено.',
    };
  }

  async findRunsByTournament(tournamentId: string, user: JwtPayload) {
    // Залишається без змін (тільки пошук)
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, creatorId: true },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);
    return this.prisma.simulationRun.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async clearSimulationCaches(tournamentId: string) {
    await this.cacheManager.del(`/matches/tournament/${tournamentId}`);
    await this.cacheManager.del(`/tournaments/${tournamentId}`);
    await this.cacheManager.del('/tournaments/workflow?workflow=generation');
    await this.cacheManager.del('/tournaments/workflow?workflow=simulation');
  }

  private async checkManualMatchesCollision(
    tournamentId: string,
    stage: Stage,
  ) {
    const hasManualMatches = await this.prisma.match.findFirst({
      where: { tournamentId, stage, isProcessed: true },
    });
    if (hasManualMatches) {
      throw new BadRequestException(
        `Турнір вже містить зіграні матчі в стадії ${stage}. Перезапис неможливий. Використовуйте режим прогнозу.`,
      );
    }
  }
}
