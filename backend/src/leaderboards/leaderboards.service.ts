import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { Player, Prisma, Team } from '@prisma/client';
import { paginate } from 'common/utils/paginate.util';

@Injectable()
export class LeaderboardsService {
  constructor(private prisma: PrismaService) {}

  async getTeamsLeaderboard(query: LeaderboardQueryDto) {
    const whereCondition: Prisma.TeamWhereInput = {
      status: 'ACTIVE', // Показуємо тільки активні команди
      ...(query.region && { region: query.region }),
      ...(query.gameSlug && { game: { slug: query.gameSlug } }),
      ...(query.tier && { tier: query.tier }),
      ...(query.isComplete !== undefined && {
        isComplete: query.isComplete === 'true',
      }),
    };

    // Гнучкий пошук: шукаємо збіг або в імені, або в тегу
    if (query.search) {
      whereCondition.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { tag: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return paginate<Team>(
      this.prisma.team,
      whereCondition,
      query,
      {
        game: true,
        // Додаємо селект гравців, щоб рахувати їх кількість на фронті
        players: { select: { id: true, nickname: true, teamRole: true } },
      },
      {
        averageRating: 'desc',
      },
    );
  }

  async getPlayersLeaderboard(query: LeaderboardQueryDto) {
    const whereCondition: Prisma.PlayerWhereInput = {};
    if (query.region) {
      whereCondition.team = { region: query.region };
    }
    if (query.gameSlug) {
      whereCondition.game = { slug: query.gameSlug };
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
