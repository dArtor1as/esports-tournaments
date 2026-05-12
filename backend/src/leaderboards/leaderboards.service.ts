import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LeaderboardsService {
  constructor(private prisma: PrismaService) {}

  async getTeamsLeaderboard(query: LeaderboardQueryDto) {
    const { page = 1, limit = 100, region } = query;
    const skip = (page - 1) * limit;

    // Формуємо умови пошуку
    const whereCondition: Prisma.TeamWhereInput = {
      status: 'ACTIVE', // Не показуємо розпущені команди
    };
    if (region) {
      whereCondition.region = region;
    }

    const [teams, totalCount] = await Promise.all([
      this.prisma.team.findMany({
        where: whereCondition,
        orderBy: { averageRating: 'desc' }, // Сортуємо від найсильніших
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          tag: true,
          averageRating: true,
          tier: true,
          logoUrl: true,
          region: true,
        },
      }),
      this.prisma.team.count({ where: whereCondition }),
    ]);

    return {
      data: teams,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getPlayersLeaderboard(query: LeaderboardQueryDto) {
    const { page = 1, limit = 100, region } = query;
    const skip = (page - 1) * limit;

    const whereCondition: Prisma.PlayerWhereInput = {};

    // Якщо є фільтр по регіону, шукаємо гравців, чиї команди належать до цього регіону
    if (region) {
      whereCondition.team = { region };
    }

    const [players, totalCount] = await Promise.all([
      this.prisma.player.findMany({
        where: whereCondition,
        orderBy: { rating: 'desc' }, // Сортуємо за індивідуальним Elo
        skip,
        take: limit,
        select: {
          id: true,
          nickname: true,
          rating: true,
          stats: true, // Віддаємо статистику, щоб на фронті можна було показати KPR/WinRate
          team: {
            select: { id: true, name: true, tag: true, logoUrl: true },
          },
        },
      }),
      this.prisma.player.count({ where: whereCondition }),
    ]);

    return {
      data: players,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }
}
