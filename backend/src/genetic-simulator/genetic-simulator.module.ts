import { Module } from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { GeneticSimulatorController } from './genetic-simulator.controller';
import { MatchSimulatorsModule } from 'src/match-simulators/match-simulators.module';
import { ProbabilityCalculatorService } from './probability-calculator.service';
import { SingleEliminationStrategy } from './strategies/single-elimination.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';

@Module({
  imports: [MatchSimulatorsModule],
  controllers: [GeneticSimulatorController],
  providers: [
    GeneticSimulatorService,
    MatchSimulatorsModule,
    ProbabilityCalculatorService,
    SingleEliminationStrategy,
    GroupStageStrategy,
    DoubleEliminationStrategy,
  ],
})
export class GeneticSimulatorModule {}
