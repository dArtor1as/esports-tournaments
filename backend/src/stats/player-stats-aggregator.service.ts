import { Injectable } from '@nestjs/common';
import { GamePlayerStat, BaseMapStat } from './stats.types';

export interface PlayerStatsData {
  total_roundsPlayed?: number | string;
  total_kills?: number | string;
  total_deaths?: number | string;
  total_assists?: number | string;
  matchesPlayed?: number | string;
  totalMapsPlayed?: number | string;
  winRate?: string | number;
  [key: string]: string | number | undefined; // Дозволяємо інші динамічні поля
}

@Injectable()
export class PlayerStatsAggregatorService {
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
    damage: { avg: true },
  };

  private readonly DERIVED_STATS = [
    {
      name: 'kpr',
      formula: (stat: PlayerStatsData) =>
        Number(stat.total_roundsPlayed)
          ? (
              Number(stat.total_kills) / Number(stat.total_roundsPlayed)
            ).toFixed(2)
          : null,
    },
    {
      name: 'dpr',
      formula: (stat: PlayerStatsData) =>
        Number(stat.total_roundsPlayed)
          ? (
              Number(stat.total_deaths) / Number(stat.total_roundsPlayed)
            ).toFixed(2)
          : null,
    },
    {
      name: 'apr',
      formula: (stat: PlayerStatsData) =>
        Number(stat.total_roundsPlayed)
          ? (
              Number(stat.total_assists) / Number(stat.total_roundsPlayed)
            ).toFixed(2)
          : null,
    },
  ];

  getSummedPlayerStatsForMatch(
    maps: BaseMapStat[],
    teamKey: 'teamA' | 'teamB',
  ): GamePlayerStat[] {
    const playerTotals = new Map<
      string,
      GamePlayerStat & { mapCount: number }
    >();

    for (const match of maps) {
      const teamData = match[teamKey];
      if (!teamData || !Array.isArray(teamData.players)) continue;

      for (const participant of teamData.players) {
        if (!playerTotals.has(participant.playerId)) {
          // Зберігаємо першу карту і додаємо лічильник
          playerTotals.set(participant.playerId, {
            ...participant,
            mapCount: 1,
          });
        } else {
          // Якщо гравець вже є, оновлюємо суму і збільшуємо лічильник карт
          const current = playerTotals.get(participant.playerId)!;
          current.mapCount += 1;

          for (const [k, v] of Object.entries(participant)) {
            // cумуємо показники (кіли, смерті, adr) з усіх карт матчу
            if (typeof v === 'number' && k !== 'mapCount') {
              // додаємо до існуючого значення або ініціалізуємо його, якщо це перша карта для цього гравця
              const currentValue = current[k];
              current[k] =
                (typeof currentValue === 'number' ? currentValue : 0) + v;
            }
          }
        }
      }
    }

    return Array.from(playerTotals.values()) as GamePlayerStat[];
  }

  calculateNewLifetimeStats(
    oldStats: PlayerStatsData,
    sessionStats: Record<string, unknown>,
    isWinner: boolean,
  ): PlayerStatsData {
    const oldMatches = Number(oldStats.matchesPlayed) || 0;
    const newMatches = oldMatches + 1;
    // Рахуємо карти (якщо є старі дані)
    const oldMaps = Number(oldStats.totalMapsPlayed) || oldMatches;
    const addedMaps = Number(sessionStats.mapCount) || 1;
    const newTotalMaps = oldMaps + addedMaps;
    // Спільна логіка для всіх ігор : Вінрейт
    const oldWinRate = parseFloat(String(oldStats.winRate || '50'));
    const winValue = isWinner ? 100 : 0;
    const newWinRate = (oldWinRate * oldMatches + winValue) / newMatches;
    // Об'єкт нової статистики (динамічно наповнюється)
    const newStatsJson: PlayerStatsData = {
      matchesPlayed: newMatches,
      totalMapsPlayed: newTotalMaps,
      winRate: newWinRate.toFixed(2),
    };
    // динамічний парсинг ключів
    // проходимо по всіх полях, які прийшли з симулятора
    for (const [key, value] of Object.entries(sessionStats)) {
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
      if (value !== null) newStatsJson[rule.name] = value;
    }

    return newStatsJson;
  }
}
