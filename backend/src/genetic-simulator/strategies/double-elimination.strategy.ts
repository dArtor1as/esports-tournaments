import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseGeneticStrategy } from './base-genetic.strategy';
import { SimulationContext, StrategyResult } from '../genetic-simulator.types';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import { Individual } from '../genetic-simulator.types';

@Injectable()
export class DoubleEliminationStrategy extends BaseGeneticStrategy {
  constructor(
    private prisma: PrismaService,
    probabilityCalc: ProbabilityCalculatorService,
  ) {
    super(probabilityCalc);
  }

  execute(
    simulationContext: SimulationContext,
    populations: number,
  ): StrategyResult {
    const startedAt = Date.now();

    const bestIndividual = this.evolvePopulation<Individual>(
      populations,
      simulationContext.estimatedGenesNeeded,
      (genes) => this.evaluatePlayoffIndividual(genes, simulationContext),
    );

    const executionTimeMs = Date.now() - startedAt;

    return {
      bestFitnessScore: bestIndividual.fitness,
      bracket: bestIndividual.bracket,
      algorithmType: 'DOUBLE_ELIMINATION',
      executionTimeMs,
      generations: this.generations,
    };
  }
}
