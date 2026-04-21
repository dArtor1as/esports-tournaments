import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { HeuristicSeedingService } from './heuristic-seeding.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, HeuristicSeedingService],
})
export class MatchesModule {}
