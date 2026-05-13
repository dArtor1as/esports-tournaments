import { ProbabilityCalculatorService } from '../probability-calculator.service';
import {
  BaseIndividual,
  SimulationMatch,
  SimulationContext,
} from '../genetic-simulator.types';

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
    simulationContext: SimulationContext,
    getGeneRoll: () => number,
  ) {
    const teamAId = match.teamAId!;
    const teamBId = match.teamBId!;

    const baseProbA = this.probabilityCalc.getBaseProbability(
      simulationContext.teamRatings[teamAId],
      simulationContext.teamRatings[teamBId],
    );
    const expectedProbA = this.probabilityCalc.getAdjustedProbability(
      baseProbA,
      teamAId,
      teamBId,
      simulationContext.pastMatches,
    );

    const teamA = simulationContext.teamsData[teamAId];
    const teamB = simulationContext.teamsData[teamBId];

    const result = simulationContext.simulator.simulateSeries(
      teamA,
      teamB,
      expectedProbA,
      match.bestOf,
      getGeneRoll,
    );

    match.scoreA = result.winsA;
    match.scoreB = result.winsB;
    match.details = { maps: result.mapDetails };
    match.stats = result.stats;

    const matchWinnerIsA = result.winsA > result.winsB;
    const winnerId = matchWinnerIsA ? teamAId : teamBId;
    const loserId = matchWinnerIsA ? teamBId : teamAId;
    const winnerProb = matchWinnerIsA ? expectedProbA : 1 - expectedProbA;

    return {
      matchWinnerIsA,
      winnerId,
      loserId,
      winnerProb,
      winsA: result.winsA,
      winsB: result.winsB,
    };
  }
}
