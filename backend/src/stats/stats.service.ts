import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MatchStatsJson, GamePlayerStat } from './stats.types';
import { TeamsService } from '../teams/teams.service';
import { PlayersService } from '../players/players.service';

@Injectable()
export class StatsService {
  private readonly STAT_RULES: Record<
    string,
    { total?: boolean; avg?: boolean }
  > = {
    kills: { total: true, avg: true },
    deaths: { total: true, avg: true },
    assists: { total: true, avg: true },
    headshots: { total: true, avg: true },
    netWorth: { total: true, avg: true },
    roundsPlayed: { total: true },
    adr: { avg: true },
    gpm: { avg: true },
    xpm: { avg: true },
  };
  // НОВЕ: Правила для похідних метрик (OCP-compliant)
  private readonly DERIVED_STATS: Array<{
    name: string;
    formula: (stats: Record<string, string | number>) => string | null;
  }> = [
    {
      name: 'kpr',
      formula: (s) =>
        Number(s.total_roundsPlayed)
          ? (Number(s.total_kills) / Number(s.total_roundsPlayed)).toFixed(2)
          : null,
    },
    {
      name: 'dpr',
      formula: (s) =>
        Number(s.total_roundsPlayed)
          ? (Number(s.total_deaths) / Number(s.total_roundsPlayed)).toFixed(2)
          : null,
    },
    {
      name: 'apr',
      formula: (s) =>
        Number(s.total_roundsPlayed)
          ? (Number(s.total_assists) / Number(s.total_roundsPlayed)).toFixed(2)
          : null,
    },
  ];
  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
    private playersService: PlayersService,
  ) {}

  async processTournamentStats(tournamentId: string) {
    // 1. Отримуємо турнір разом із матчами
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        matches: {
          where: {
            isProcessed: true,
            stats: { not: Prisma.AnyNull }, // Перевірка на наявність статів
            // Беремо лише ті матчі, які ще не оброблені в історії рейтингу
            ratingHistories: { none: {} },
          },
          orderBy: { round: 'asc' },
        },
      },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
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
    const currentPlayerStats = new Map<
      string,
      Record<string, string | number>
    >();

    const matches = tournament.matches; // Зберігаємо в змінну для TS

    for (const match of matches) {
      if (!match.teamAId || !match.teamBId || !match.stats) continue;

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

      let winsA = 0;
      let winsB = 0;
      if (stats.maps && Array.isArray(stats.maps)) {
        stats.maps.forEach((m) => {
          if (m.teamA.score > m.teamB.score) winsA++;
          else winsB++;
        });
      }

      const isAWinner = winsA > winsB;

      // K-FACTOR
      // 1. Групи = 20, Плей-оф = 32, Гранд Фінал = 40
      let baseK = 32;
      if (match.stage === 'GROUP') baseK = 20;
      if (match.bracket === 'GRAND_FINAL') baseK = 40;

      // 2. Якщо грають профи топ рівня (>3000 Elo), зменшуємо зміну рейтингу
      if (ratingA > 3000 || ratingB > 3000) baseK = 16;

      const finalK = baseK * tournament.kFactor;

      // Рахуємо зміну Elo
      const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
      const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

      const actualA = isAWinner ? 1 : 0;
      const actualB = isAWinner ? 0 : 1;

      let changeA = Math.round(finalK * (actualA - expectedA));
      let changeB = Math.round(finalK * (actualB - expectedB));

      //  бонус за чемпіонство
      if (match.bracket === 'GRAND_FINAL') {
        const championshipBonus = Math.round(30 * tournament.kFactor); // +30 Elo за кубок
        if (isAWinner) changeA += championshipBonus;
        else changeB += championshipBonus;
      }

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
      );

      // Б) Записуємо Історію Команд
      transactionQueries.push(
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

      // В) Обробляємо Lifetime Stats гравців (через динамічний метод)
      if (stats.maps && Array.isArray(stats.maps)) {
        const avgPlayersA = this.getSummedPlayerStatsForMatch(
          stats.maps,
          'teamA',
        );
        const avgPlayersB = this.getSummedPlayerStatsForMatch(
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
      }
    }

    // виконуємо всі накопичені оновлення в одній транзакції для цілісності даних
    await this.prisma.$transaction(transactionQueries);

    return {
      message: "Рейтинги Elo та кар'єрна статистика успішно оновлені.",
      processedMatches: matches.length,
    };
  }

  //  допоміжні методи (Через відповідні сервіси)

  private getSummedPlayerStatsForMatch(
    maps: any[],
    teamKey: 'teamA' | 'teamB',
  ): GamePlayerStat[] {
    const playerTotals = new Map<string, any>();

    for (const m of maps) {
      if (!m[teamKey] || !Array.isArray(m[teamKey].players)) continue;
      for (const p of m[teamKey].players) {
        if (!playerTotals.has(p.playerId)) {
          // Зберігаємо першу карту і додаємо лічильник
          playerTotals.set(p.playerId, { ...p, mapCount: 1 });
        } else {
          const current = playerTotals.get(p.playerId);
          current.mapCount += 1;
          for (const [k, v] of Object.entries(p)) {
            // СУМУЄМО показники (кіли, смерті, adr) з усіх карт матчу
            if (typeof v === 'number' && k !== 'mapCount') current[k] += v;
          }
        }
      }
    }

    return Array.from(playerTotals.values()) as GamePlayerStat[];
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
    statsCache: Map<string, Record<string, string | number>>,
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
        oldStats = (player?.stats as Record<string, string | number>) || {};
      }

      const oldMatches = Number(oldStats.matchesPlayed) || 0;
      const newMatches = oldMatches + 1;

      // Рахуємо карти (якщо є старі дані)
      const oldMaps = Number(oldStats.totalMapsPlayed) || oldMatches;
      const addedMaps = Number((pStat as any).mapCount) || 1;
      const newTotalMaps = oldMaps + addedMaps;

      // Спільна логіка для всіх ігор : Вінрейт
      const oldWinRate = parseFloat(String(oldStats.winRate || '50'));
      const winValue = isWinner ? 100 : 0;
      const newWinRate = (oldWinRate * oldMatches + winValue) / newMatches;

      // Об'єкт нової статі (динамічно наповнюється)
      const newStatsJson: Record<string, string | number> = {
        matchesPlayed: newMatches,
        totalMapsPlayed: newTotalMaps,
        winRate: newWinRate.toFixed(2),
      };

      // динамічний парсинг ключів
      // проходимо по всіх полях, які прийшли з симулятора
      for (const [key, value] of Object.entries(pStat)) {
        // 1. Шукаємо ключ у нашому словнику STAT_RULES
        const rule = this.STAT_RULES[key];

        // 2. Якщо ключа немає в словнику (playerId, mapCount, rating)
        // або це не число - просто ігноруємо його
        if (!rule || typeof value !== 'number') continue;

        const avgKey = `avg_${key}`;

        if (rule.total) {
          const totalKey = `total_${key}`;
          const fallbackTotal =
            parseFloat(String(oldStats[avgKey] || '0')) * oldMaps;
          const oldTotalValue = Number(oldStats[totalKey]) || fallbackTotal;

          const newTotalValue = oldTotalValue + value;
          const newAvgValue = newTotalValue / newTotalMaps;

          newStatsJson[totalKey] = Number.isInteger(value)
            ? Math.round(newTotalValue)
            : Number(newTotalValue.toFixed(1));

          newStatsJson[avgKey] = newAvgValue.toFixed(2);
        } else if (rule.avg) {
          const oldAvgValue = parseFloat(String(oldStats[avgKey] || '0'));
          const newAvgValue = (oldAvgValue * oldMaps + value) / newTotalMaps;

          newStatsJson[avgKey] = newAvgValue.toFixed(1);
        }
      }

      // розрахунок похідних метрик (KPR, DPR, APR)
      for (const rule of this.DERIVED_STATS) {
        const value = rule.formula(newStatsJson);
        if (value !== null) {
          newStatsJson[rule.name] = value;
        }
      }

      statsCache.set(pStat.playerId, newStatsJson);

      transactionQueries.push(
        this.prisma.player.update({
          where: { id: pStat.playerId },
          data: {
            rating: newRating,
            stats: newStatsJson as Prisma.InputJsonValue,
          },
        }),
      );

      transactionQueries.push(
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
