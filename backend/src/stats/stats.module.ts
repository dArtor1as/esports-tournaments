import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TeamsService } from 'src/teams/teams.service';
import { PlayersService } from 'src/players/players.service';
import { StatsAnalyticsService } from './stats-analytics.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { EloCalculatorService } from './elo-calculator.service';
import { PlayerStatsAggregatorService } from './player-stats-aggregator.service';
import { AnalyticsController } from './analytics.controller';
import { StatsTransactionBuilder } from './stats-transaction.builder';

@Module({
  controllers: [StatsController, AnalyticsController],
  providers: [
    StatsService,
    PrismaService,
    TeamsService,
    PlayersService,
    StatsAnalyticsService,
    AccessPolicyService,
    EloCalculatorService,
    PlayerStatsAggregatorService,
    StatsTransactionBuilder,
  ],
  exports: [StatsService],
})
export class StatsModule {}
