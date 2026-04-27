import { Module } from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { GeneticSimulatorController } from './genetic-simulator.controller';
import { MatchSimulatorsModule } from 'src/match-simulators/match-simulators.module';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { ProbabilityCalculatorService } from './probability-calculator.service';

@Module({
  controllers: [GeneticSimulatorController],
  providers: [
    GeneticSimulatorService,
    MatchSimulatorsModule,
    SimulatorFactoryService,
    ProbabilityCalculatorService,
  ],
})
export class GeneticSimulatorModule {}
