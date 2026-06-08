import { ProbabilityCalculatorService } from '../probability-calculator.service';
import {
  BaseIndividual,
  SimulationMatch,
  SimulationContext,
  Individual,
  StrategyResult,
} from '../genetic-simulator.types';

export abstract class BaseGeneticStrategy {
  protected readonly mutationRate: number = 0.05;

  constructor(protected probabilityCalc: ProbabilityCalculatorService) {}

  // Обов'язковий метод, який має реалізувати кожна конкретна стратегія
  abstract execute(
    context: SimulationContext,
    populations: number,
    generations: number,
  ): StrategyResult;

  protected evolvePopulation<T extends BaseIndividual>(
    populations: number,
    generations: number,
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

    for (let gen = 0; gen < generations; gen++) {
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
  protected evaluatePlayoffIndividual(
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

      // Беремо loserId, він потрібен для нижньої сітки
      const { matchWinnerIsA, winnerId, loserId, winnerProb, winsA, winsB } =
        this.processMatchSimulation(match, simulationContext, getGeneRoll);

      // Розрахунок Fitness
      if (winnerProb >= 0.5) {
        // 1. Основна нагорода: переміг фаворит
        fitness += winnerProb * 8;

        // бонус за суху перемогу, як у формулі
        const isSweep =
          (matchWinnerIsA && winsB === 0) || (!matchWinnerIsA && winsA === 0);
        if (isSweep) {
          fitness += 2;
        }
      } else {
        // Апсети
        if (winnerProb > 0.35) {
          fitness += 2; // невелика нагорода за незначний апсет
        } else if (winnerProb > 0.2) {
          fitness += 0; // не заохочуємо, але й не караємо
        } else {
          fitness -= 30; // кара за великий апсет
        }
      }

      // Універсальне просування переможця (працює і для SE, і для DE)
      if (match.nextMatchWinnerId) {
        const nextMatch = bracket.find((m) => m.id === match.nextMatchWinnerId);
        if (nextMatch) {
          if (!nextMatch.teamAId) nextMatch.teamAId = winnerId;
          else nextMatch.teamBId = winnerId;
        }
      }

      // Універсальне просування переможеного (для SE просто скіпається)
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
