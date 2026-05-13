import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { HeuristicSeedingService } from './heuristic-seeding.service';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { DoubleEliminationGenerator } from './generators/double-elimination.generator';
import { SingleEliminationGenerator } from './generators/single-elimination.generator';
import { StatsService } from 'src/stats/stats.service';
import { TeamsService } from 'src/teams/teams.service';
import { PlayersService } from 'src/players/players.service';

@Module({
  controllers: [MatchesController],
  providers: [
    MatchesService,
    HeuristicSeedingService,
    SingleEliminationGenerator,
    DoubleEliminationGenerator,
    GroupStageGenerator,
    StatsService,
    TeamsService,
    PlayersService,
  ],
})
export class MatchesModule {}
