import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseGeneticStrategy } from './base-genetic.strategy';
import { SimulationContext } from '../genetic-simulator.types';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import { Individual, SimulationMatch } from '../genetic-simulator.types';
import { Prisma } from '@prisma/client';
import { toPrismaJson } from 'src/prisma/prisma.utils';

@Injectable()
export class SingleEliminationStrategy extends BaseGeneticStrategy {
  constructor(
    private prisma: PrismaService,
    probabilityCalc: ProbabilityCalculatorService,
  ) {
    super(probabilityCalc); // Передаємо сервіс у базовий клас
  }

  async execute(
    simulationContext: SimulationContext,
    populations: number,
    isDryRun: boolean = true,
  ) {
    const startedAt = Date.now();

    const bestIndividual = this.evolvePopulation<Individual>(
      populations,
      simulationContext.estimatedGenesNeeded,
      (genes) => this.evaluateIndividual(genes, simulationContext),
    );

    const executionTimeMs = Date.now() - startedAt;
    if (isDryRun) {
      //режим прогнозу - не зберігаємо результати в БД, а лише повертаємо їх у відповіді
      await this.prisma.simulationRun.create({
        data: {
          tournamentId: simulationContext.tournament.id,
          algorithmType: 'PLAYOFF',
          populations,
          generations: this.generations,
          fitnessScore: bestIndividual.fitness,
          executionTimeMs,
          isDryRun: true,
          predictedData:
            bestIndividual.bracket as unknown as Prisma.InputJsonValue, // Зберігаємо прогноз сітки
        },
      });

      return {
        message: `Аналітичний прогноз завершено. Пройдено ${this.generations} поколінь.`,
        bestFitnessScore: bestIndividual.fitness,
        bracket: bestIndividual.bracket,
      };
    } else {
      // Зберігаємо результати саме для Playoff
      await this.prisma.$transaction([
        ...bestIndividual.bracket.map((match) =>
          this.prisma.match.update({
            where: { id: match.id },
            data: {
              teamAId: match.teamAId,
              teamBId: match.teamBId,
              scoreA: match.scoreA,
              scoreB: match.scoreB,
              details: toPrismaJson(match.details),
              stats: toPrismaJson(match.stats),
              isProcessed: true,
            },
          }),
        ),
        this.prisma.tournament.update({
          where: { id: simulationContext.tournament.id },
          data: { status: 'finished' },
        }),
        this.prisma.simulationRun.create({
          data: {
            tournamentId: simulationContext.tournament.id,
            algorithmType: 'PLAYOFF',
            populations,
            generations: this.generations,
            fitnessScore: bestIndividual.fitness,
            executionTimeMs,
            isDryRun: false,
          },
        }),
      ]);

      return {
        message: `Еволюцію (Playoff) завершено. Пройдено ${this.generations} поколінь.`,
        bestFitnessScore: bestIndividual.fitness,
      };
    }
  }

  private evaluateIndividual(
    genes: number[],
    simulationContext: SimulationContext,
  ): Individual {
    const bracket: SimulationMatch[] = simulationContext.baseSkeleton.map(
      (m) => ({ ...m }),
    );
    let fitness = 0;
    let currentGeneIndex = 0;
    const getGeneRoll = () =>
      currentGeneIndex < genes.length
        ? genes[currentGeneIndex++]
        : Math.random();

    for (let i = 0; i < bracket.length; i++) {
      const match = bracket[i];
      if (!match.teamAId || !match.teamBId) continue;

      const { matchWinnerIsA, winnerId, winnerProb, winsA, winsB } =
        this.processMatchSimulation(match, simulationContext, getGeneRoll);

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

      if (match.nextMatchWinnerId) {
        const nextMatch = bracket.find((m) => m.id === match.nextMatchWinnerId);
        if (nextMatch) {
          if (!nextMatch.teamAId) nextMatch.teamAId = winnerId;
          else nextMatch.teamBId = winnerId;
        }
      }
    }

    return { genes, fitness, bracket };
  }
}
