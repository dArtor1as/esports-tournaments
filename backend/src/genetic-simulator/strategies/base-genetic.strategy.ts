import { Match } from '@prisma/client';
import { IMatchSimulator } from 'src/match-simulators/match-simulator.interface';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import { BaseIndividual, SimulationMatch } from '../genetic-simulator.types';

// Спільний інтерфейс для контексту, який ми будемо передавати в стратегії
export interface SimulationContext {
  tournament: any;
  simulator: IMatchSimulator;
  pastMatches: Match[];
  teamRatings: Record<string, number>;
  baseSkeleton: SimulationMatch[];
  estimatedGenesNeeded: number;
  matchCount: number;
}

export abstract class BaseGeneticStrategy {
  protected readonly generations = 20;
  protected readonly mutationRate = 0.05;

  constructor(protected probabilityCalc: ProbabilityCalculatorService) {}

  // Обов'язковий метод, який має реалізувати кожна конкретна стратегія
  abstract execute(
    context: SimulationContext,
    populations: number,
  ): Promise<any>;

  protected evolvePopulation<T extends BaseIndividual>(
    populations: number,
    estimatedGenesNeeded: number,
    evaluatorFunc: (genes: number[]) => T,
  ): T {
    let population: T[] = [];

    for (let i = 0; i < populations; i++) {
      const randomGenes = Array.from({ length: estimatedGenesNeeded }, () =>
        Math.random(),
      );
      population.push(evaluatorFunc(randomGenes));
    }

    for (let gen = 0; gen < this.generations; gen++) {
      population.sort((a, b) => b.fitness - a.fitness);
      const nextGeneration: T[] = [];
      const eliteCount = Math.floor(populations * 0.1);

      for (let i = 0; i < eliteCount; i++) nextGeneration.push(population[i]);

      while (nextGeneration.length < populations) {
        const parentA =
          population[Math.floor(Math.random() * (populations / 2))];
        const parentB =
          population[Math.floor(Math.random() * (populations / 2))];
        const childGenes: number[] = [];

        for (let i = 0; i < estimatedGenesNeeded; i++) {
          let gene = Math.random() < 0.5 ? parentA.genes[i] : parentB.genes[i];
          if (Math.random() < this.mutationRate) gene = Math.random();
          childGenes.push(gene);
        }

        nextGeneration.push(evaluatorFunc(childGenes));
      }
      population = nextGeneration;
    }

    population.sort((a, b) => b.fitness - a.fitness);
    return population[0];
  }

  protected processMatchSimulation(
    match: SimulationMatch,
    ctx: SimulationContext,
    getGeneRoll: () => number,
  ) {
    const teamA = match.teamAId!;
    const teamB = match.teamBId!;

    const baseProbA = this.probabilityCalc.getBaseProbability(
      ctx.teamRatings[teamA],
      ctx.teamRatings[teamB],
    );
    const expectedProbA = this.probabilityCalc.getAdjustedProbability(
      baseProbA,
      teamA,
      teamB,
      ctx.pastMatches,
    );

    const { winsA, winsB, mapDetails } = ctx.simulator.simulateSeries(
      expectedProbA,
      match.bestOf,
      getGeneRoll,
    );

    match.scoreA = winsA;
    match.scoreB = winsB;
    match.details = { maps: mapDetails };

    const matchWinnerIsA = winsA > winsB;
    const winnerId = matchWinnerIsA ? teamA : teamB;
    const winnerProb = matchWinnerIsA ? expectedProbA : 1 - expectedProbA;

    return { matchWinnerIsA, winnerId, winnerProb, winsA, winsB };
  }
}
