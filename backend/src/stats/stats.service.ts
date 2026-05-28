import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MatchStatsJson } from './stats.types';
import { TeamsService } from '../teams/teams.service';
import { PlayersService } from '../players/players.service';
import {
  PlayerStatsAggregatorService,
  PlayerStatsData,
} from './player-stats-aggregator.service';
import { AccessPolicyService } from '../auth/access-policy.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { StatsTransactionBuilder } from './stats-transaction.builder';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
    private playersService: PlayersService,
    private statsAggregator: PlayerStatsAggregatorService,
    private accessPolicy: AccessPolicyService,
    private builder: StatsTransactionBuilder,
  ) {}

  async processTournamentStats(tournamentId: string, user?: JwtPayload) {
    // 1. Отримуємо турнір разом із матчами
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        matches: {
          where: {
            isProcessed: true,
            // Беремо лише ті матчі, які ще не оброблені в історії рейтингу
            ratingHistories: { none: {} },
          },
          orderBy: { round: 'asc' },
        },
      },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    if (user) {
      this.accessPolicy.checkTournamentCreatorOrAdmin(
        tournament.creatorId,
        user,
      );
    }
    if (tournament.matches.length === 0) {
      return {
        message: 'Усі доступні матчі турніру вже оброблені.',
        processedMatches: 0,
      };
    }

    const transactionQueries: Prisma.PrismaPromise<unknown>[] = [];
    const currentTeamRatings = new Map<string, number>();
    const currentPlayerRatings = new Map<string, number>();
    const currentPlayerStats = new Map<string, PlayerStatsData>();

    for (const match of tournament.matches) {
      if (!match.teamAId || !match.teamBId) continue;

      // 1. Отримуємо рейтинги команд з кешу або БД
      const ratingA = await this.fetchTeamRating(
        match.teamAId,
        currentTeamRatings,
      );
      const ratingB = await this.fetchTeamRating(
        match.teamBId,
        currentTeamRatings,
      );

      // 2. Білдер формує апдейти для команд (чиста логіка)
      const {
        queries: teamQueries,
        newRatingA,
        newRatingB,
        changeA,
        changeB,
        isAWinner,
      } = this.builder.buildTeamMatchUpdates(
        {
          id: match.id,
          stage: match.stage,
          bracket: match.bracket,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
        },
        tournament.kFactor,
        ratingA,
        ratingB,
      );

      transactionQueries.push(...teamQueries);
      currentTeamRatings.set(match.teamAId, newRatingA);
      currentTeamRatings.set(match.teamBId, newRatingB);

      // 3. Обробляємо гравців
      const stats = match.stats as unknown as MatchStatsJson;

      if (stats && stats.maps && Array.isArray(stats.maps)) {
        // Симуляція: є детальна статистика по картах
        const avgPlayersA = this.statsAggregator.getSummedPlayerStatsForMatch(
          stats.maps,
          'teamA',
        );
        const avgPlayersB = this.statsAggregator.getSummedPlayerStatsForMatch(
          stats.maps,
          'teamB',
        );

        for (const pStat of avgPlayersA) {
          const queries = await this.processPlayer(
            pStat.playerId,
            match.id,
            changeA,
            isAWinner,
            pStat as Record<string, unknown>,
            currentPlayerRatings,
            currentPlayerStats,
          );
          transactionQueries.push(...queries);
        }
        for (const pStat of avgPlayersB) {
          const queries = await this.processPlayer(
            pStat.playerId,
            match.id,
            changeB,
            !isAWinner,
            pStat as Record<string, unknown>,
            currentPlayerRatings,
            currentPlayerStats,
          );
          transactionQueries.push(...queries);
        }
      } else {
        // Технічна поразка (ручне закриття матчу)
        const rosters = await this.prisma.tournamentRoster.findMany({
          where: {
            participant: {
              tournamentId: tournament.id,
              teamId: { in: [match.teamAId, match.teamBId] },
            },
          },
          include: { participant: true },
        });

        for (const roster of rosters) {
          if (roster.role === 'COACH' || roster.role === 'SUBSTITUTE') continue;
          const isTeamA = roster.participant.teamId === match.teamAId;
          const eloChange = isTeamA ? changeA : changeB;
          const isWinner = isTeamA ? isAWinner : !isAWinner;

          const queries = await this.processPlayer(
            roster.playerId,
            match.id,
            eloChange,
            isWinner,
            { mapCount: 1 },
            currentPlayerRatings,
            currentPlayerStats,
          );
          transactionQueries.push(...queries);
        }
      }
    }

    // Робимо єдиний запит до бази даних
    await this.prisma.$transaction(transactionQueries);
    return {
      message: "Рейтинги Elo та кар'єрна статистика успішно оновлені.",
      processedMatches: tournament.matches.length,
    };
  }

  // Допоміжний метод для обробки одного гравця
  private async processPlayer(
    playerId: string,
    matchId: string,
    eloChange: number,
    isWinner: boolean,
    sessionStats: Record<string, unknown>,
    ratingCache: Map<string, number>,
    statsCache: Map<string, PlayerStatsData>,
  ): Promise<Prisma.PrismaPromise<unknown>[]> {
    if (!playerId) return [];

    const currentRating = await this.fetchPlayerRating(playerId, ratingCache);

    let oldStats = statsCache.get(playerId);
    if (!oldStats) {
      const player = await this.prisma.player.findUnique({
        where: { id: playerId },
        select: { stats: true },
      });
      oldStats = (player?.stats as PlayerStatsData) || {};
    }

    // Викликаємо Білдер
    const { queries, newRating, newStatsJson } =
      this.builder.buildPlayerStatsUpdates(
        matchId,
        playerId,
        currentRating,
        eloChange,
        oldStats,
        sessionStats,
        isWinner,
      );

    // Оновлюємо кеш
    ratingCache.set(playerId, newRating);
    statsCache.set(playerId, newStatsJson);

    return queries;
  }

  private async fetchTeamRating(
    teamId: string,
    cache: Map<string, number>,
  ): Promise<number> {
    if (cache.has(teamId)) return cache.get(teamId) as number;

    const team = await this.teamsService.findOne(teamId);
    if (!team) {
      throw new Error(
        `Критична помилка цілісності: Команду ${teamId} не знайдено!`,
      );
    }
    cache.set(teamId, team.averageRating);
    return team.averageRating;
  }

  private async fetchPlayerRating(
    playerId: string,
    cache: Map<string, number>,
  ): Promise<number> {
    if (cache.has(playerId)) return cache.get(playerId) as number;

    const player = await this.playersService.findOne(playerId);
    if (!player) {
      throw new Error(
        `Критична помилка цілісності: Гравця ${playerId} не знайдено!`,
      );
    }
    cache.set(playerId, player.rating);
    return player.rating;
  }
}
