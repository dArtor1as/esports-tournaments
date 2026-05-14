import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
  ) {}

  // Головні методи запуску
  async runSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const targetStage = dto.stage || Stage.PLAYOFF;
    const context =
      await this.simulationContextBuilder.prepareSimulationContext(
        dto.tournamentId,
        targetStage,
        user,
      );

    const isDryRun = dto.isDryRun ?? true;

    // Блокуємо COMMIT-симуляцію, якщо турнір вже грається людьми
    if (!isDryRun) {
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

    // Логіка вибору стратегії на основі налаштувань турніру
    const bracketType = context.tournament.settings?.bracketType;
    let result;
    if (bracketType === 'DOUBLE_ELIMINATION') {
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

    const isDryRun = dto.isDryRun ?? true;

    if (!isDryRun) {
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

    const result = await this.groupStageStrategy.execute(
      context,
      dto.populations,
      isDryRun,
    );

    //запускаємо обробку статистики тільки якщо це не dry run, тобто якщо ми закоммітили результати в БD
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
