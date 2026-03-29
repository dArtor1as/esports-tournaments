import { Module } from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { GeneticSimulatorController } from './genetic-simulator.controller';
import { Cs2SimulatorService } from './cs2-simulator.service';
import { ProbabilityCalculatorService } from './probability-calculator.service';

@Module({
  controllers: [GeneticSimulatorController],
  providers: [
    GeneticSimulatorService,
    Cs2SimulatorService,
    ProbabilityCalculatorService,
  ],
})
export class GeneticSimulatorModule {}
