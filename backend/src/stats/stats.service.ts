import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MatchStatsJson, GamePlayerStat } from './stats.types';
import { TeamsService } from '../teams/teams.service';
import { PlayersService } from '../players/players.service';
import {
  PlayerStatsAggregatorService,
  PlayerStatsData,
} from './player-stats-aggregator.service';
import { EloCalculatorService } from './elo-calculator.service';
import { AccessPolicyService } from '../auth/access-policy.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
    private playersService: PlayersService,
    private eloCalculator: EloCalculatorService,
    private statsAggregator: PlayerStatsAggregatorService,
    private accessPolicy: AccessPolicyService,
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
        message:
          'Усі доступні матчі турніру вже оброблені або нові результати відсутні.',
        processedMatches: 0,
      };
    }

    // Явно вказуємо тип масиву транзакцій
    const transactionQueries: Prisma.PrismaPromise<unknown>[] = [];

    const currentTeamRatings = new Map<string, number>();
    const currentPlayerRatings = new Map<string, number>();
    const currentPlayerStats = new Map<string, PlayerStatsData>();

    const matches = tournament.matches; // Зберігаємо в змінну для TS

    for (const match of matches) {
      if (!match.teamAId || !match.teamBId) continue;

      // SRP: Використовуємо інжектовані сервіси для читання даних
      const ratingA = await this.fetchTeamRating(
        match.teamAId,
        currentTeamRatings,
      );
      const ratingB = await this.fetchTeamRating(
        match.teamBId,
        currentTeamRatings,
      );

      // Використовуємо динамічну типізацію для JSON
      const stats = match.stats as unknown as MatchStatsJson;
      // Визначаємо переможця по рахунку
      const isAWinner = match.scoreA > match.scoreB;

      // ДЕЛЕГУЄМО РОЗРАХУНОК ELO
      const { changeA, changeB } = this.eloCalculator.calculateElo(
        ratingA,
        ratingB,
        isAWinner,
        tournament.kFactor,
        match.stage,
        match.bracket,
      );

      const newRatingA = ratingA + changeA;
      const newRatingB = ratingB + changeB;
      // Визначаємо новий тір для обох команд
      const newTierA = this.teamsService.calculateTier(newRatingA);
      const newTierB = this.teamsService.calculateTier(newRatingB);

      currentTeamRatings.set(match.teamAId, newRatingA);
      currentTeamRatings.set(match.teamBId, newRatingB);

      // А) Оновлюємо рейтинг команд (накопичуємо запити для транзакції)
      transactionQueries.push(
        this.prisma.team.update({
          where: { id: match.teamAId },
          data: { averageRating: newRatingA, tier: newTierA },
        }),
        this.prisma.team.update({
          where: { id: match.teamBId },
          data: { averageRating: newRatingB, tier: newTierB },
        }),

        // Б) Записуємо Історію Команд
        this.prisma.ratingHistory.create({
          data: {
            teamId: match.teamAId,
            matchId: match.id,
            oldRating: ratingA,
            newRating: newRatingA,
            ratingChange: changeA,
          },
        }),
        this.prisma.ratingHistory.create({
          data: {
            teamId: match.teamBId,
            matchId: match.id,
            oldRating: ratingB,
            newRating: newRatingB,
            ratingChange: changeB,
          },
        }),
      );

      // В) Обробляємо Lifetime Stats гравців (тільки якщо є детальна статистика)
      if (stats && stats.maps && Array.isArray(stats.maps)) {
        const avgPlayersA = this.statsAggregator.getSummedPlayerStatsForMatch(
          stats.maps,
          'teamA',
        );
        const avgPlayersB = this.statsAggregator.getSummedPlayerStatsForMatch(
          stats.maps,
          'teamB',
        );

        await this.queuePlayerUpdates(
          avgPlayersA,
          match.id,
          changeA,
          currentPlayerRatings,
          currentPlayerStats,
          transactionQueries,
          isAWinner,
        );
        await this.queuePlayerUpdates(
          avgPlayersB,
          match.id,
          changeB,
          currentPlayerRatings,
          currentPlayerStats,
          transactionQueries,
          !isAWinner,
        );
      } else {
        // Технічна поразка (forfeit) або ручне введення без карт
        // Нараховуємо Elo всім гравцям, що були заявлені в TournamentRoster
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

          // Оновлюємо тільки Elo та вінрейт (через агрегатор із порожніми статами сесії)
          await this.applyTechnicalEloToPlayer(
            roster.playerId,
            match.id,
            eloChange,
            isWinner,
            transactionQueries,
          );
        }
      }
    }

    await this.prisma.$transaction(transactionQueries);
    return {
      message: "Рейтинги Elo та кар'єрна статистика успішно оновлені.",
      processedMatches: tournament.matches.length,
    };
  }

  private async applyTechnicalEloToPlayer(
    playerId: string,
    matchId: string,
    change: number,
    isWinner: boolean,
    queries: Prisma.PrismaPromise<unknown>[],
  ) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) return;

    const newRating = player.rating + change;
    const oldStats = (player.stats as PlayerStatsData) || {};

    // Створюємо "заглушку" сесії для техпоразки (mapCount: 1, але 0 вбивств/смертей)
    const newStats = this.statsAggregator.calculateNewLifetimeStats(
      oldStats,
      { mapCount: 1 },
      isWinner,
    );

    queries.push(
      this.prisma.player.update({
        where: { id: playerId },
        data: { rating: newRating, stats: newStats as Prisma.InputJsonValue },
      }),
      this.prisma.ratingHistory.create({
        data: {
          playerId,
          matchId,
          oldRating: player.rating,
          newRating,
          ratingChange: change,
        },
      }),
    );
  }

  private async fetchTeamRating(
    teamId: string,
    cache: Map<string, number>,
  ): Promise<number> {
    if (cache.has(teamId)) return cache.get(teamId) as number;

    const team = await this.teamsService.findOne(teamId);
    if (!team) {
      throw new Error(
        `Критична помилка цілісності: Команду з ID ${teamId} не знайдено в базі!`,
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
        `Критична помилка цілісності: Гравця з ID ${playerId} не знайдено в базі!`,
      );
    }
    cache.set(playerId, player.rating);
    return player.rating;
  }

  private async queuePlayerUpdates(
    mapPlayers: GamePlayerStat[],
    matchId: string,
    eloChange: number,
    ratingCache: Map<string, number>,
    statsCache: Map<string, PlayerStatsData>,
    transactionQueries: Prisma.PrismaPromise<unknown>[],
    isWinner: boolean,
  ) {
    if (!mapPlayers || !Array.isArray(mapPlayers)) return;

    for (const pStat of mapPlayers) {
      if (!pStat.playerId) continue;

      const currentRating = await this.fetchPlayerRating(
        pStat.playerId,
        ratingCache,
      );
      const newRating = currentRating + eloChange;

      ratingCache.set(pStat.playerId, newRating);

      // беремо стару стату гравця з кешу. Якщо немає - дістаємо з бази.
      let oldStats = statsCache.get(pStat.playerId);
      if (!oldStats) {
        const player = await this.prisma.player.findUnique({
          where: { id: pStat.playerId },
          select: { stats: true },
        });
        oldStats = (player?.stats as PlayerStatsData) || {};
      }

      const newStatsJson = this.statsAggregator.calculateNewLifetimeStats(
        oldStats,
        pStat as Record<string, unknown>,
        isWinner,
      );
      statsCache.set(pStat.playerId, newStatsJson);

      transactionQueries.push(
        this.prisma.player.update({
          where: { id: pStat.playerId },
          data: {
            rating: newRating,
            stats: newStatsJson as Prisma.InputJsonValue,
          },
        }),
        this.prisma.ratingHistory.create({
          data: {
            playerId: pStat.playerId,
            matchId: matchId,
            oldRating: currentRating,
            newRating: newRating,
            ratingChange: eloChange,
          },
        }),
      );
    }
  }
}
