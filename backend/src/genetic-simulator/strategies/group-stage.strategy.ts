import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseGeneticStrategy } from './base-genetic.strategy';
import { SimulationContext } from '../genetic-simulator.types';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import {
  GroupIndividual,
  GroupStanding,
  SimulationMatch,
} from '../genetic-simulator.types';
import { Prisma } from '@prisma/client';
import { toPrismaJson } from 'src/prisma/prisma.utils';

@Injectable()
export class GroupStageStrategy extends BaseGeneticStrategy {
  constructor(
    private prisma: PrismaService,
    probabilityCalc: ProbabilityCalculatorService,
  ) {
    super(probabilityCalc);
  }

  async execute(
    simulationContext: SimulationContext,
    populations: number,
    isDryRun = true,
  ) {
    const startedAt = Date.now();

    const bestIndividual = this.evolvePopulation<GroupIndividual>(
      populations,
      simulationContext.estimatedGenesNeeded,
      (genes) => this.evaluateGroupIndividual(genes, simulationContext),
    );

    const executionTimeMs = Date.now() - startedAt;
    if (isDryRun) {
      // Зберігаємо і матчі, і згенеровану таблицю
      const predictedPayload = {
        bracket: bestIndividual.bracket,
        standings: bestIndividual.standings,
      };

      await this.prisma.simulationRun.create({
        data: {
          tournamentId: simulationContext.tournament.id,
          algorithmType: 'GROUP_STAGE',
          populations,
          generations: this.generations,
          fitnessScore: bestIndividual.fitness,
          executionTimeMs,
          isDryRun: true,
          predictedData: predictedPayload as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        message: `Аналітичний прогноз груп завершено. Проаналізовано ${simulationContext.matchCount} матчів.`,
        bestFitnessScore: bestIndividual.fitness,
        standings: bestIndividual.standings,
        bracket: bestIndividual.bracket,
      };
    } else {
      // Зберігаємо результати саме для Груп
      await this.prisma.$transaction([
        ...bestIndividual.bracket.map((match) =>
          this.prisma.match.update({
            where: { id: match.id },
            data: {
              scoreA: match.scoreA,
              scoreB: match.scoreB,
              details: toPrismaJson(match.details),
              stats: toPrismaJson(match.stats),
              isProcessed: true,
            },
          }),
        ),
        ...simulationContext.tournament.participants.map((participant: any) => {
          const stats = bestIndividual.standings[participant.teamId];
          return this.prisma.tournamentParticipant.update({
            where: { id: participant.id },
            data: {
              groupPoints: stats?.points || 0,
              matchesWon: stats?.matchesWon || 0,
              matchesLost: stats?.matchesLost || 0,
              mapsWon: stats?.mapsWon || 0,
              mapsLost: stats?.mapsLost || 0,
            },
          });
        }),
        this.prisma.simulationRun.create({
          data: {
            tournamentId: simulationContext.tournament.id,
            algorithmType: 'GROUP_STAGE',
            populations,
            generations: this.generations,
            fitnessScore: bestIndividual.fitness,
            executionTimeMs,
            isDryRun: false,
          },
        }),
      ]);

      return {
        message: `Групову еволюцію завершено. Проаналізовано ${simulationContext.matchCount} матчів.`,
        bestFitnessScore: bestIndividual.fitness,
        standings: bestIndividual.standings,
      };
    }
  }

  private evaluateGroupIndividual(
    genes: number[],
    simulationContext: SimulationContext,
  ): GroupIndividual {
    const bracket: SimulationMatch[] = simulationContext.baseSkeleton.map(
      (m) => ({ ...m }),
    );
    let fitness = 0;
    let currentGeneIndex = 0;
    const getGeneRoll = () =>
      currentGeneIndex < genes.length
        ? genes[currentGeneIndex++]
        : Math.random();

    const standings: Record<string, GroupStanding> = {};
    Object.keys(simulationContext.teamRatings).forEach((teamId) => {
      standings[teamId] = {
        points: 0,
        matchesWon: 0,
        matchesLost: 0,
        mapsWon: 0,
        mapsLost: 0,
        h2h: {},
      };
    });

    for (let i = 0; i < bracket.length; i++) {
      const match = bracket[i];
      if (!match.teamAId || !match.teamBId) continue;

      const teamA = match.teamAId;
      const teamB = match.teamBId;

      const { matchWinnerIsA, winnerProb, winsA, winsB } =
        this.processMatchSimulation(match, simulationContext, getGeneRoll);

      if (matchWinnerIsA) {
        standings[teamA].points += 3;
        standings[teamA].matchesWon += 1;
        standings[teamB].matchesLost += 1;
        standings[teamA].h2h[teamB] = (standings[teamA].h2h[teamB] || 0) + 1;
      } else {
        standings[teamB].points += 3;
        standings[teamB].matchesWon += 1;
        standings[teamA].matchesLost += 1;
        standings[teamB].h2h[teamA] = (standings[teamB].h2h[teamA] || 0) + 1;
      }

      standings[teamA].mapsWon += winsA;
      standings[teamA].mapsLost += winsB;
      standings[teamB].mapsWon += winsB;
      standings[teamB].mapsLost += winsA;

      if (winnerProb >= 0.5) {
        fitness += winnerProb * 8;
      } else {
        if (winnerProb > 0.35) fitness += 5;
        else if (winnerProb > 0.2) fitness += 0;
        else fitness -= 15;
      }
    }

    return { genes, fitness, bracket, standings };
  }
}
