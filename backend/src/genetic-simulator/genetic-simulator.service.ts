import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { Stage } from '@prisma/client';
import { SimulationMatch } from './genetic-simulator.types';
import { SingleEliminationStrategy } from './strategies/single-elimination.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { SimulationContext } from './genetic-simulator.types';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { StatsService } from 'src/stats/stats.service';
import { SimulationContextBuilder } from './simulation-context.builder';

@Injectable()
export class GeneticSimulatorService {
  constructor(
    private prisma: PrismaService,
    private matchSimulator: SimulatorFactoryService,
    private statsService: StatsService,
    private simulationContextBuilder: SimulationContextBuilder,
    // Інжектимо стратегії:
    private singleEliminationStrategy: SingleEliminationStrategy,
    private groupStageStrategy: GroupStageStrategy,
    private doubleEliminationStrategy: DoubleEliminationStrategy,
  ) {}

  // Головні методи запуску
  async runSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const context =
      await this.simulationContextBuilder.prepareSimulationContext(
        dto.tournamentId,
        Stage.PLAYOFF,
        user,
      );

    // Логіка вибору стратегії на основі налаштувань турніру
    const bracketType = context.tournament.settings?.bracketType;
    let result;
    if (bracketType === 'DOUBLE_ELIMINATION') {
      result = await this.doubleEliminationStrategy.execute(
        context,
        dto.populations,
      );
    } else {
      result = await this.singleEliminationStrategy.execute(
        context,
        dto.populations,
      );
    }
    // Після того, як турнір отримав статус 'finished'
    // ми одразу викликаємо наш сервіс для урахування статистики та оновлення Elo рейтингу
    await this.statsService.processTournamentStats(dto.tournamentId);

    return {
      ...result,
      statsMessage: 'Статистику гравців та рейтинги Elo успішно перераховано!',
    };
  }

  async runGroupSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const context =
      await this.simulationContextBuilder.prepareSimulationContext(
        dto.tournamentId,
        Stage.GROUP,
        user,
      );
    const result = await this.groupStageStrategy.execute(
      context,
      dto.populations,
    );

    //запускаємо обробку статистики
    await this.statsService.processTournamentStats(dto.tournamentId);

    return {
      ...result,
      statsMessage: 'Результати груп та Elo гравців успішно оновлено.',
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

    if (tournament.creatorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Ви не маєте права запускати симуляцію для чужого турніру',
      );
    }

    return this.prisma.simulationRun.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
