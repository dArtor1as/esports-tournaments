import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { HeuristicSeedingService } from './heuristic-seeding.service';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { DoubleEliminationGenerator } from './generators/double-elimination.generator';
import { SingleEliminationGenerator } from './generators/single-elimination.generator';
import { StatsService } from 'src/stats/stats.service';
import { TeamsService } from 'src/teams/teams.service';
import { PlayersService } from 'src/players/players.service';
import { MatchesProgressionService } from './matches-progression.service';
import { MatchesConsensusService } from './matches-consensus.service';
import { MatchesGeneratorService } from './matches-generator.service';
import { MatchesQueryController } from './matches-query.controller';

@Module({
  controllers: [MatchesController, MatchesQueryController],
  providers: [
    HeuristicSeedingService,
    SingleEliminationGenerator,
    DoubleEliminationGenerator,
    GroupStageGenerator,
    StatsService,
    TeamsService,
    PlayersService,
    MatchesGeneratorService,
    MatchesConsensusService,
    MatchesProgressionService,
  ],
})
export class MatchesModule {}
