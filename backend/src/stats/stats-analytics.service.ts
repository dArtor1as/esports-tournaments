import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getTeamRatingHistory(teamId: string) {
    return this.prisma.ratingHistory.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' }, /// Від найстарішого до найновішого
      include: {
        match: { select: { tournament: { select: { title: true } } } },
      },
    });
  }

  async getPlayerRatingHistory(playerId: string) {
    return this.prisma.ratingHistory.findMany({
      where: { playerId },
      orderBy: { createdAt: 'asc' },
      include: {
        match: { select: { tournament: { select: { title: true } } } },
      },
    });
  }
}
