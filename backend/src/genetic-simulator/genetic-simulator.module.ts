import { Module } from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { GeneticSimulatorController } from './genetic-simulator.controller';
import { MatchSimulatorsModule } from 'src/match-simulators/match-simulators.module';
import { ProbabilityCalculatorService } from './probability-calculator.service';
import { SingleEliminationStrategy } from './strategies/single-elimination.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { StatsModule } from 'src/stats/stats.module';
import { SimulationContextBuilder } from './simulation-context.builder';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Module({
  imports: [MatchSimulatorsModule, StatsModule],
  controllers: [GeneticSimulatorController],
  providers: [
    GeneticSimulatorService,
    MatchSimulatorsModule,
    ProbabilityCalculatorService,
    SingleEliminationStrategy,
    GroupStageStrategy,
    DoubleEliminationStrategy,
    SimulationContextBuilder,
    AccessPolicyService,
  ],
})
export class GeneticSimulatorModule {}
