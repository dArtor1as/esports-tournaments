import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseGeneticStrategy } from './base-genetic.strategy';
import { SimulationContext, StrategyResult } from '../genetic-simulator.types';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import { Individual } from '../genetic-simulator.types';

@Injectable()
export class SingleEliminationStrategy extends BaseGeneticStrategy {
  constructor(
    private prisma: PrismaService,
    probabilityCalc: ProbabilityCalculatorService,
  ) {
    super(probabilityCalc); // Передаємо сервіс у базовий клас
  }

  execute(
    simulationContext: SimulationContext,
    populations: number,
    generations: number,
  ): StrategyResult {
    const startedAt = Date.now();

    const bestIndividual = this.evolvePopulation<Individual>(
      populations,
      generations,
      simulationContext.estimatedGenesNeeded,
      (genes) => this.evaluatePlayoffIndividual(genes, simulationContext),
    );

    const executionTimeMs = Date.now() - startedAt;

    return {
      bestFitnessScore: bestIndividual.fitness,
      bracket: bestIndividual.bracket,
      algorithmType: 'SINGLE_ELIMINATION',
      executionTimeMs,
      generations: generations,
    };
  }
}
