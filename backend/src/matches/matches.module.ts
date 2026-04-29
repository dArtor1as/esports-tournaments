import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { HeuristicSeedingService } from './heuristic-seeding.service';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { DoubleEliminationGenerator } from './generators/double-elimination.generator';
import { SingleEliminationGenerator } from './generators/single-elimination.generator';

@Module({
  controllers: [MatchesController],
  providers: [
    MatchesService,
    HeuristicSeedingService,
    SingleEliminationGenerator,
    DoubleEliminationGenerator,
    GroupStageGenerator,
  ],
})
export class MatchesModule {}
