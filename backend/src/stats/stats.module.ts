import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TeamsService } from 'src/teams/teams.service';
import { PlayersService } from 'src/players/players.service';
import { StatsAnalyticsService } from './stats-analytics.service';

@Module({
  controllers: [StatsController],
  providers: [
    StatsService,
    PrismaService,
    TeamsService,
    PlayersService,
    StatsAnalyticsService,
  ],
  exports: [StatsService],
})
export class StatsModule {}
