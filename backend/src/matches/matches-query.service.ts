import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Stage } from '@prisma/client';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { PaginationQueryDto } from 'common/dto/pagination-query.dto';
import { paginate } from 'common/utils/paginate.util';

@Injectable()
export class MatchesQueryService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
  ) {}

  // 1. Детальна сторінка матчу (Match Room)
  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        tournament: { select: { title: true, gameId: true } },
        teamA: { include: { players: true } },
        teamB: { include: { players: true } },
        ratingHistories: true, // Історія змін ело після цього матчу
      },
    });

    if (!match) throw new NotFoundException('Матч не знайдено');
    return match;
  }

  // 2. Розклад для команди (Upcoming Matches)
  async getUpcomingMatches(teamId: string) {
    return this.prisma.match.findMany({
      where: {
        isProcessed: false,
        OR: [{ teamAId: teamId }, { teamBId: teamId }],
      },
      include: {
        tournament: { select: { title: true } },
        teamA: { select: { name: true, tag: true, logoUrl: true } },
        teamB: { select: { name: true, tag: true, logoUrl: true } },
      },
      orderBy: { round: 'asc' },
    });
  }

  // 3. Стрічка останніх результатів (Recent Results)
  async getRecentResults(limit: number = 20) {
    return this.prisma.match.findMany({
      where: { isProcessed: true },
      take: limit,
      orderBy: { playedAt: 'desc' },
      include: {
        tournament: { select: { title: true } },
        teamA: { select: { name: true, tag: true, logoUrl: true } },
        teamB: { select: { name: true, tag: true, logoUrl: true } },
      },
    });
  }

  // 4. Панель Адміністратора: Конфліктні матчі (Disputed Matches)
  // 4a. ГЛОБАЛЬНІ диспути (Тільки для Адмінів платформи)
  async getAllDisputedMatches(query: PaginationQueryDto) {
    return paginate(
      this.prisma.match,
      { matchStatus: 'DISPUTED' },
      query,
      {
        tournament: { select: { title: true, creatorId: true } },
        teamA: { select: { name: true, tag: true } },
        teamB: { select: { name: true, tag: true } },
      },
      { playedAt: 'asc' },
    );
  }

  // 4b. ЛОКАЛЬНІ диспути (Для Організатора конкретного турніру)
  async getTournamentDisputedMatches(tournamentId: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { creatorId: true },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    // Перевірка прав (Творець або Адмін)
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    return this.prisma.match.findMany({
      where: {
        tournamentId,
        matchStatus: 'DISPUTED',
      },
      include: {
        teamA: { select: { name: true, tag: true } },
        teamB: { select: { name: true, tag: true } },
      },
      orderBy: { playedAt: 'asc' },
    });
  }

  //  Історія матчів команди (для профілю команди)
  async getTeamMatchesHistory(teamId: string, query: PaginationQueryDto) {
    return paginate(
      this.prisma.match,
      {
        isProcessed: true, // Тільки завершені матчі
        OR: [{ teamAId: teamId }, { teamBId: teamId }],
      },
      query,
      {
        tournament: {
          select: { title: true, tier: true, game: { select: { slug: true } } },
        },
        teamA: { select: { id: true, name: true, tag: true, logoUrl: true } },
        teamB: { select: { id: true, name: true, tag: true, logoUrl: true } },
      },
      { playedAt: 'desc' }, // Найновіші зверху
    );
  }

  //   Історія матчів ГРАВЦЯ (для профілю гравця)
  async getPlayerMatchesHistory(playerId: string, query: PaginationQueryDto) {
    // Шукаємо матчі, де гравець був у ростері команди під час турніру
    // Це трохи складніший запит, але Prisma з ним впорається
    return paginate(
      this.prisma.match,
      {
        isProcessed: true,
        tournament: {
          participants: {
            some: {
              tournamentRosters: { some: { playerId: playerId } },
            },
          },
        },
      },
      query,
      {
        tournament: {
          select: { title: true, tier: true, game: { select: { slug: true } } },
        },
        teamA: { select: { id: true, name: true, tag: true, logoUrl: true } },
        teamB: { select: { id: true, name: true, tag: true, logoUrl: true } },
      },
      { playedAt: 'desc' },
    );
  }

  // метод отримання сітки матчів для турніру (для сторінки турніру)
  async findAllByTournament(tournamentId: string, stage?: Stage) {
    const whereCondition: any = { tournamentId };
    if (stage) whereCondition.stage = stage;

    return this.prisma.match.findMany({
      where: whereCondition,
      orderBy: [{ stage: 'asc' }, { groupName: 'asc' }, { round: 'asc' }],
      include: {
        teamA: { select: { id: true, name: true, tag: true, logoUrl: true } },
        teamB: { select: { id: true, name: true, tag: true, logoUrl: true } },
        nextMatchWinner: { select: { id: true, round: true } },
      },
    });
  }
}
