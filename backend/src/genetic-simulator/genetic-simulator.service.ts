import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { Stage } from '@prisma/client';
import { SimulationMatch } from './genetic-simulator.types';
import { SingleEliminationStrategy } from './strategies/single-elimination.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { SimulationContext } from './strategies/base-genetic.strategy';

@Injectable()
export class GeneticSimulatorService {
  constructor(
    private prisma: PrismaService,
    private matchSimulator: SimulatorFactoryService,
    // Інжектимо стратегії:
    private singleEliminationStrategy: SingleEliminationStrategy,
    private groupStageStrategy: GroupStageStrategy,
    private doubleEliminationStrategy: DoubleEliminationStrategy,
  ) {}

  // метод підготовки, він використовується для всіх типів симуляцій, щоб отримати всі необхідні дані та контекст
  private async prepareSimulationContext(
    tournamentId: string,
    stage: Stage,
  ): Promise<SimulationContext> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: { include: { team: true } },
        game: true,
      },
    });

    if (!tournament || tournament.status !== 'live') {
      throw new BadRequestException(
        `Турнір має бути у статусі live. Спочатку згенеруйте сітку/групи.`,
      );
    }

    const simulator = this.matchSimulator.getSimulator(tournament.game.slug);

    const pastMatches = await this.prisma.match.findMany({
      where: {
        tournamentId: { not: tournamentId },
        isProcessed: true,
      },
    });

    const teamRatings: Record<string, number> = {};
    tournament.participants.forEach((p) => {
      teamRatings[p.teamId] = p.team.averageRating;
    });

    const dbMatches = await this.prisma.match.findMany({
      where: { tournamentId, stage },
    });

    if (dbMatches.length === 0) {
      throw new BadRequestException(`Матчі для стадії ${stage} порожні`);
    }

    if (stage === Stage.PLAYOFF) {
      dbMatches.sort((a, b) => {
        // 0. Гранд-фінал ЗАВЖДИ розраховується останнім
        if (a.bracket === 'GRAND_FINAL') return 1;
        if (b.bracket === 'GRAND_FINAL') return -1;

        // 1. Спочатку сортуємо за раундами
        if (a.round !== b.round) return a.round - b.round;

        // 2. В межах одного раунду UPPER має йти ПЕРЕД LOWER
        const bracketOrder = { UPPER: 1, LOWER: 2, NONE: 3 };
        return bracketOrder[a.bracket] - bracketOrder[b.bracket];
      });
    } else {
      dbMatches.sort((a, b) => a.id.localeCompare(b.id));
    }

    const baseSkeleton: SimulationMatch[] = dbMatches.map((m) => ({
      id: m.id,
      round: m.round,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      scoreA: 0,
      scoreB: 0,
      bestOf: m.bestOf,
      nextMatchWinnerId: m.nextMatchWinnerId,
      nextMatchLoserId: m.nextMatchLoserId,
    }));

    return {
      tournament,
      simulator,
      pastMatches,
      teamRatings,
      baseSkeleton,
      estimatedGenesNeeded: baseSkeleton.length * 3,
      matchCount: baseSkeleton.length,
    };
  }

  // Головні методи запуску
  async runSimulation(dto: SimulateTournamentDto) {
    const context = await this.prepareSimulationContext(
      dto.tournamentId,
      Stage.PLAYOFF,
    );

    // Логіка вибору стратегії на основі налаштувань турніру
    const bracketType = context.tournament.settings?.bracketType;

    if (bracketType === 'DOUBLE_ELIMINATION') {
      return this.doubleEliminationStrategy.execute(context, dto.populations);
    }

    return this.singleEliminationStrategy.execute(context, dto.populations);
  }

  async runGroupSimulation(dto: SimulateTournamentDto) {
    const context = await this.prepareSimulationContext(
      dto.tournamentId,
      Stage.GROUP,
    );
    return this.groupStageStrategy.execute(context, dto.populations);
  }

  async findRunsByTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Турнір не знайдено');
    }

    return this.prisma.simulationRun.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
