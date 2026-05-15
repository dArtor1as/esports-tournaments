import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { Player, Prisma, Team } from '@prisma/client';
import { paginate } from 'common/utils/paginate.util';

@Injectable()
export class LeaderboardsService {
  constructor(private prisma: PrismaService) {}

  async getTeamsLeaderboard(query: LeaderboardQueryDto) {
    const whereCondition = {
      status: 'ACTIVE',
      ...(query.region && { region: query.region }),
    };

    return paginate<Team>(this.prisma.team, whereCondition, query, undefined, {
      averageRating: 'desc',
    });
  }

  async getPlayersLeaderboard(query: LeaderboardQueryDto) {
    const whereCondition: any = {};
    if (query.region) {
      whereCondition.team = { region: query.region };
    }

    return paginate<Player>(
      this.prisma.player,
      whereCondition,
      query,
      { team: { select: { id: true, name: true, tag: true, logoUrl: true } } },
      { rating: 'desc' },
    );
  }
}
