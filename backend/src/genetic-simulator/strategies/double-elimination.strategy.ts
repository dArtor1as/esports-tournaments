import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BaseGeneticStrategy,
  SimulationContext,
} from './base-genetic.strategy';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import { Individual, SimulationMatch } from '../genetic-simulator.types';

@Injectable()
export class DoubleEliminationStrategy extends BaseGeneticStrategy {
  constructor(
    private prisma: PrismaService,
    probabilityCalc: ProbabilityCalculatorService,
  ) {
    super(probabilityCalc);
  }

  async execute(ctx: SimulationContext, populations: number) {
    const startedAt = Date.now();

    const bestIndividual = this.evolvePopulation<Individual>(
      populations,
      ctx.estimatedGenesNeeded,
      (genes) => this.evaluateIndividual(genes, ctx),
    );

    const executionTimeMs = Date.now() - startedAt;

    await this.prisma.$transaction([
      ...bestIndividual.bracket.map((match) =>
        this.prisma.match.update({
          where: { id: match.id },
          data: {
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            details: match.details,
            isProcessed: true,
          },
        }),
      ),
      this.prisma.tournament.update({
        where: { id: ctx.tournament.id },
        data: { status: 'finished' },
      }),
      this.prisma.simulationRun.create({
        data: {
          tournamentId: ctx.tournament.id,
          algorithmType: 'DOUBLE_ELIMINATION',
          populations,
          generations: this.generations,
          fitnessScore: bestIndividual.fitness,
          executionTimeMs,
        },
      }),
    ]);

    return {
      message: `Еволюцію (Double Elimination) завершено. Пройдено ${this.generations} поколінь.`,
      bestFitnessScore: bestIndividual.fitness,
    };
  }

  private evaluateIndividual(
    genes: number[],
    ctx: SimulationContext,
  ): Individual {
    const bracket: SimulationMatch[] = ctx.baseSkeleton.map((m) => ({ ...m }));
    let fitness = 0;
    let currentGeneIndex = 0;
    const getGeneRoll = () =>
      currentGeneIndex < genes.length
        ? genes[currentGeneIndex++]
        : Math.random();

    for (let i = 0; i < bracket.length; i++) {
      const match = bracket[i];

      // Якщо матч ще не сформований (очікує переможця/переможеного з попередніх раундів)
      if (!match.teamAId || !match.teamBId) continue;

      const { matchWinnerIsA, winnerId, winnerProb, winsA, winsB } =
        this.processMatchSimulation(match, ctx, getGeneRoll);

      const loserId = matchWinnerIsA ? match.teamBId : match.teamAId;

      // Розрахунок Fitness
      if (winnerProb >= 0.5) {
        fitness += winnerProb * 10;
        if (
          (matchWinnerIsA && winsB === 0) ||
          (!matchWinnerIsA && winsA === 0)
        ) {
          fitness += winnerProb * 3;
        }
      } else {
        if (winnerProb > 0.4) fitness += 2;
        else if (winnerProb > 0.25) fitness -= 5;
        else fitness -= 30;
      }

      // Просування переможця
      if (match.nextMatchWinnerId) {
        const nextMatch = bracket.find((m) => m.id === match.nextMatchWinnerId);
        if (nextMatch) {
          if (!nextMatch.teamAId) nextMatch.teamAId = winnerId;
          else nextMatch.teamBId = winnerId;
        }
      }

      // Просування переможеного (специфіка Double Elimination)
      if (match.nextMatchLoserId) {
        const nextMatchLB = bracket.find(
          (m) => m.id === match.nextMatchLoserId,
        );
        if (nextMatchLB) {
          if (!nextMatchLB.teamAId) nextMatchLB.teamAId = loserId;
          else nextMatchLB.teamBId = loserId;
        }
      }
    }

    return { genes, fitness, bracket };
  }
}
