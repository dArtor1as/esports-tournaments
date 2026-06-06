import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseGeneticStrategy } from './base-genetic.strategy';
import { SimulationContext, StrategyResult } from '../genetic-simulator.types';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import {
  GroupIndividual,
  GroupStanding,
  SimulationMatch,
} from '../genetic-simulator.types';

@Injectable()
export class GroupStageStrategy extends BaseGeneticStrategy {
  constructor(
    private prisma: PrismaService,
    probabilityCalc: ProbabilityCalculatorService,
  ) {
    super(probabilityCalc);
  }

  execute(
    simulationContext: SimulationContext,
    populations: number,
    generations: number,
  ): StrategyResult {
    const startedAt = Date.now();

    const bestIndividual = this.evolvePopulation<GroupIndividual>(
      populations,
      generations,
      simulationContext.estimatedGenesNeeded,
      (genes) => this.evaluateGroupIndividual(genes, simulationContext),
    );

    const executionTimeMs = Date.now() - startedAt;

    return {
      bestFitnessScore: bestIndividual.fitness,
      bracket: bestIndividual.bracket,
      standings: bestIndividual.standings,
      algorithmType: 'GROUP_STAGE',
      executionTimeMs,
      generations: generations,
    };
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
