import { Injectable } from '@nestjs/common';
import { GamePlayerStat } from './stats.types';

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
  };

  private readonly DERIVED_STATS = [
    {
      name: 'kpr',
      formula: (stat: any) =>
        Number(stat.total_roundsPlayed)
          ? (
              Number(stat.total_kills) / Number(stat.total_roundsPlayed)
            ).toFixed(2)
          : null,
    },
    {
      name: 'dpr',
      formula: (stat: any) =>
        Number(stat.total_roundsPlayed)
          ? (
              Number(stat.total_deaths) / Number(stat.total_roundsPlayed)
            ).toFixed(2)
          : null,
    },
    {
      name: 'apr',
      formula: (stat: any) =>
        Number(stat.total_roundsPlayed)
          ? (
              Number(stat.total_assists) / Number(stat.total_roundsPlayed)
            ).toFixed(2)
          : null,
    },
  ];

  getSummedPlayerStatsForMatch(
    maps: any[],
    teamKey: 'teamA' | 'teamB',
  ): GamePlayerStat[] {
    const playerTotals = new Map<string, any>();

    for (const match of maps) {
      if (!match[teamKey] || !Array.isArray(match[teamKey].players)) continue;
      for (const participant of match[teamKey].players) {
        if (!playerTotals.has(participant.playerId)) {
          // Зберігаємо першу карту і додаємо лічильник
          playerTotals.set(participant.playerId, {
            ...participant,
            mapCount: 1,
          });
        } else {
          const current = playerTotals.get(participant.playerId);
          current.mapCount += 1;
          for (const [k, v] of Object.entries(participant)) {
            // cумуємо показники (кіли, смерті, adr) з усіх карт матчу
            if (typeof v === 'number' && k !== 'mapCount') current[k] += v;
          }
        }
      }
    }

    return Array.from(playerTotals.values()) as GamePlayerStat[];
  }

  calculateNewLifetimeStats(
    oldStats: any,
    sessionStats: any,
    isWinner: boolean,
  ): Record<string, string | number> {
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
    const newStatsJson: Record<string, string | number> = {
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
