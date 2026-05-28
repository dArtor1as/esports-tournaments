import { Injectable } from '@nestjs/common';
import { Match, Prisma } from '@prisma/client';

@Injectable()
export class MatchesProgressionLogic {
  // генерація команд для оновлення бази даних при закритті матчу
  public calculateProgressionUpdates(
    match: Match,
    scoreA: number,
    scoreB: number,
    nextWinnerMatch: Match | null,
    nextLoserMatch: Match | null,
  ): { id: string; data: Prisma.MatchUncheckedUpdateInput }[] {
    const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId;
    const loserId = scoreA > scoreB ? match.teamBId : match.teamAId;

    const updates: { id: string; data: Prisma.MatchUncheckedUpdateInput }[] =
      [];

    // 1. Оновлюємо поточний матч
    updates.push({
      id: match.id,
      data: {
        scoreA,
        scoreB,
        isProcessed: true,
        matchStatus: 'COMPLETED', // Відразу закриваємо консенсус
        stats: Prisma.JsonNull, // Ручні матчі не мають статистики K/D
      },
    });

    // 2. Просування переможця
    if (nextWinnerMatch && winnerId) {
      if (!nextWinnerMatch.teamAId) {
        updates.push({ id: nextWinnerMatch.id, data: { teamAId: winnerId } });
      } else {
        updates.push({ id: nextWinnerMatch.id, data: { teamBId: winnerId } });
      }
    }

    // 3. Просування переможеного
    if (nextLoserMatch && loserId) {
      if (!nextLoserMatch.teamAId) {
        updates.push({ id: nextLoserMatch.id, data: { teamAId: loserId } });
      } else {
        updates.push({ id: nextLoserMatch.id, data: { teamBId: loserId } });
      }
    }

    return updates;
  }

  // Допоміжні методи для сортування команд усередині групи.
  // Пріоритет: 1) Очки, 2) H2H (для tie-груп), 3) Різниця карт.
  public sortGroupTeams<
    T extends {
      teamId: string;
      groupPoints: number;
      mapsWon: number;
      mapsLost: number;
    },
  >(
    teams: T[],
    groupMatches?: Array<{
      teamAId: string | null;
      teamBId: string | null;
      scoreA: number;
      scoreB: number;
      isProcessed: boolean;
    }>,
  ): T[] {
    const sorted = [...teams].sort((a, b) => {
      if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
      const mapDiffA = a.mapsWon - a.mapsLost;
      const mapDiffB = b.mapsWon - b.mapsLost;
      if (mapDiffB !== mapDiffA) return mapDiffB - mapDiffA;
      if (b.mapsWon !== a.mapsWon) return b.mapsWon - a.mapsWon;
      return a.teamId.localeCompare(b.teamId);
    });

    if (!groupMatches || groupMatches.length === 0) return sorted;

    let index = 0;
    while (index < sorted.length) {
      const start = index;
      const tiedPoints = sorted[index].groupPoints;
      while (index < sorted.length && sorted[index].groupPoints === tiedPoints)
        index += 1;
      const end = index;
      if (end - start <= 1) continue;

      const tiedTeams = sorted.slice(start, end);
      const h2hRanked = this.rankByHeadToHead(tiedTeams, groupMatches);
      sorted.splice(start, tiedTeams.length, ...h2hRanked);
    }
    return sorted;
  }

  private rankByHeadToHead<
    T extends { teamId: string; mapsWon: number; mapsLost: number },
  >(
    tiedTeams: T[],
    groupMatches: Array<{
      teamAId: string | null;
      teamBId: string | null;
      scoreA: number;
      scoreB: number;
      isProcessed: boolean;
    }>,
  ): T[] {
    const tiedTeamIds = new Set(tiedTeams.map((team) => team.teamId));
    const directMatches = groupMatches.filter((match) => {
      if (!match.isProcessed || !match.teamAId || !match.teamBId) return false;
      return (
        tiedTeamIds.has(match.teamAId) &&
        tiedTeamIds.has(match.teamBId) &&
        match.scoreA !== match.scoreB
      );
    });

    if (directMatches.length === 0) return [...tiedTeams];

    const h2hStats = new Map<
      string,
      { wins: number; mapsWon: number; mapsLost: number; matchesPlayed: number }
    >();
    for (const team of tiedTeams) {
      h2hStats.set(team.teamId, {
        wins: 0,
        mapsWon: 0,
        mapsLost: 0,
        matchesPlayed: 0,
      });
    }

    for (const match of directMatches) {
      const teamAId = match.teamAId;
      const teamBId = match.teamBId;
      if (!teamAId || !teamBId) continue;

      const teamAStats = h2hStats.get(teamAId);
      const teamBStats = h2hStats.get(teamBId);
      if (!teamAStats || !teamBStats) continue;

      teamAStats.mapsWon += match.scoreA;
      teamAStats.mapsLost += match.scoreB;
      teamAStats.matchesPlayed += 1;

      teamBStats.mapsWon += match.scoreB;
      teamBStats.mapsLost += match.scoreA;
      teamBStats.matchesPlayed += 1;

      if (match.scoreA > match.scoreB) teamAStats.wins += 1;
      else teamBStats.wins += 1;
    }

    const allTeamsHaveH2H = tiedTeams.every(
      (team) => (h2hStats.get(team.teamId)?.matchesPlayed ?? 0) > 0,
    );
    if (!allTeamsHaveH2H) return [...tiedTeams];

    return [...tiedTeams].sort((a, b) => {
      const aStats = h2hStats.get(a.teamId);
      const bStats = h2hStats.get(b.teamId);
      if (!aStats || !bStats) return a.teamId.localeCompare(b.teamId);
      if (bStats.wins !== aStats.wins) return bStats.wins - aStats.wins;

      const aH2HMapDiff = aStats.mapsWon - aStats.mapsLost;
      const bH2HMapDiff = bStats.mapsWon - bStats.mapsLost;
      if (bH2HMapDiff !== aH2HMapDiff) return bH2HMapDiff - aH2HMapDiff;
      if (bStats.mapsWon !== aStats.mapsWon)
        return bStats.mapsWon - aStats.mapsWon;

      const overallMapDiffA = a.mapsWon - a.mapsLost;
      const overallMapDiffB = b.mapsWon - b.mapsLost;
      if (overallMapDiffB !== overallMapDiffA)
        return overallMapDiffB - overallMapDiffA;
      if (b.mapsWon !== a.mapsWon) return b.mapsWon - a.mapsWon;

      return a.teamId.localeCompare(b.teamId);
    });
  }
}
