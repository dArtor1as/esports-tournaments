import { Module } from '@nestjs/common';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [LeaderboardsController],
  providers: [LeaderboardsService, PrismaService],
})
export class LeaderboardsModule {}
