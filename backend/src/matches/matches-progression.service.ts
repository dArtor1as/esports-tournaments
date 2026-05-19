import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Stage, Match } from '@prisma/client';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

@Injectable()
export class MatchesProgressionService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
  ) {}
  // метод для безпечного завершення матчу і просування по сітці
  public async finalizeMatchProgression(
    prismaTx: Prisma.TransactionClient,
    match: Match,
    scoreA: number,
    scoreB: number,
  ) {
    const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId;
    const loserId = scoreA > scoreB ? match.teamBId : match.teamAId;

    const updatedMatch = await prismaTx.match.update({
      where: { id: match.id },
      data: {
        scoreA,
        scoreB,
        isProcessed: true,
        matchStatus: 'COMPLETED', // Відразу закриваємо консенсус
        stats: Prisma.JsonNull, // Ручні матчі не мають статистики K/D
      },
    });

    // Просування переможця (Верхня сітка)
    if (match.nextMatchWinnerId && winnerId) {
      const nextMatch = await prismaTx.match.findUnique({
        where: { id: match.nextMatchWinnerId },
      });
      if (nextMatch) {
        if (!nextMatch.teamAId)
          await prismaTx.match.update({
            where: { id: nextMatch.id },
            data: { teamAId: winnerId },
          });
        else
          await prismaTx.match.update({
            where: { id: nextMatch.id },
            data: { teamBId: winnerId },
          });
      }
    }

    // Просування переможеного (Нижня сітка Double Elim)
    if (match.nextMatchLoserId && loserId) {
      const nextLoserMatch = await prismaTx.match.findUnique({
        where: { id: match.nextMatchLoserId },
      });
      if (nextLoserMatch) {
        if (!nextLoserMatch.teamAId)
          await prismaTx.match.update({
            where: { id: nextLoserMatch.id },
            data: { teamAId: loserId },
          });
        else
          await prismaTx.match.update({
            where: { id: nextLoserMatch.id },
            data: { teamBId: loserId },
          });
      }
    }

    return updatedMatch;
  }

  // Аналізує результати групового етапу, визначає Топ-2 команди кожної групи
  // та оновлює їхні посіви (seed) для подальшої участі у Плей-оф.
  async transitionToPlayoffs(tournamentId: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    // Витягуємо всі матчі групи для визначення приналежності команд до груп
    const groupMatches = await this.prisma.match.findMany({
      where: { tournamentId, stage: Stage.GROUP },
      select: {
        teamAId: true,
        teamBId: true,
        groupName: true,
        isProcessed: true,
        scoreA: true,
        scoreB: true,
      },
    });

    if (!groupMatches.length) {
      throw new BadRequestException('Групові матчі не знайдені');
    }

    const allProcessed = groupMatches.every((m) => m.isProcessed);
    if (!allProcessed) {
      throw new BadRequestException(
        'Не всі матчі групового етапу завершені. Просимулюйте груповий етап повністю.',
      );
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { team: { select: { tag: true } } },
    });

    // Мапимо команди до їхніх груп на основі історії матчів
    const teamGroupMap = new Map<string, string>();
    for (const match of groupMatches) {
      if (match.teamAId && match.groupName) {
        teamGroupMap.set(match.teamAId, match.groupName);
      }
      if (match.teamBId && match.groupName) {
        teamGroupMap.set(match.teamBId, match.groupName);
      }
    }

    const groupedParticipants: Record<string, typeof participants> = {};
    const groupParticipants = participants.filter((p) =>
      teamGroupMap.has(p.teamId),
    );

    for (const p of groupParticipants) {
      const groupName = teamGroupMap.get(p.teamId);
      if (!groupName) continue;
      if (!groupedParticipants[groupName]) {
        groupedParticipants[groupName] = [];
      }
      groupedParticipants[groupName].push(p);
    }

    type ParticipantWithTeam = (typeof participants)[0];

    const firstPlaces: ParticipantWithTeam[] = [];
    const secondPlaces: ParticipantWithTeam[] = [];

    // Сортуємо кожну групу та відбираємо топ-2
    for (const groupName in groupedParticipants) {
      const groupSpecificMatches = groupMatches.filter(
        (match) => match.groupName === groupName,
      );
      const sortedGroup = this.sortGroupTeams(
        groupedParticipants[groupName],
        groupSpecificMatches,
      );

      if (sortedGroup[0]) firstPlaces.push(sortedGroup[0]);
      if (sortedGroup[1]) secondPlaces.push(sortedGroup[1]);
    }

    // Сортуємо переможців груп та другі місця для формування підсумкових посівів
    const sortedFirstPlaces = this.sortGroupTeams(firstPlaces);
    const sortedSecondPlaces = this.sortGroupTeams(secondPlaces);

    const playoffTeams = [...sortedFirstPlaces, ...sortedSecondPlaces];

    // Оновлюємо посіви (seed) в базі даних: 1-8 для тих, хто пройшов, 99 для решти
    await this.prisma.$transaction(
      participants.map((p) => {
        const playoffIndex = playoffTeams.findIndex((pt) => pt.id === p.id);
        const newSeed = playoffIndex !== -1 ? playoffIndex + 1 : 99;

        return this.prisma.tournamentParticipant.update({
          where: { id: p.id },
          data: { seed: newSeed },
        });
      }),
    );

    return {
      message:
        'Перехід до плей-оф виконано. Топ-8 команд отримали нові посіви.',
      playoffTeams: playoffTeams.map((t, index) => ({
        seed: index + 1,
        teamId: t.teamId,
        tag: t.team.tag,
        points: t.groupPoints,
      })),
    };
  }

  // Допоміжний метод для сортування команд усередині групи.
  // Пріоритет: 1) Очки, 2) H2H (для tie-груп), 3) Різниця карт.
  private sortGroupTeams<
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
      if (b.groupPoints !== a.groupPoints) {
        return b.groupPoints - a.groupPoints;
      }
      const mapDiffA = a.mapsWon - a.mapsLost;
      const mapDiffB = b.mapsWon - b.mapsLost;
      if (mapDiffB !== mapDiffA) {
        return mapDiffB - mapDiffA;
      }
      if (b.mapsWon !== a.mapsWon) {
        return b.mapsWon - a.mapsWon;
      }
      return a.teamId.localeCompare(b.teamId);
    });

    if (!groupMatches || groupMatches.length === 0) {
      return sorted;
    }

    let index = 0;
    while (index < sorted.length) {
      const start = index;
      const tiedPoints = sorted[index].groupPoints;

      while (
        index < sorted.length &&
        sorted[index].groupPoints === tiedPoints
      ) {
        index += 1;
      }

      const end = index;
      if (end - start <= 1) {
        continue;
      }

      const tiedTeams = sorted.slice(start, end);
      const h2hRanked = this.rankByHeadToHead(tiedTeams, groupMatches);
      sorted.splice(start, tiedTeams.length, ...h2hRanked);
    }

    return sorted;
  }

  private rankByHeadToHead<
    T extends {
      teamId: string;
      mapsWon: number;
      mapsLost: number;
    },
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
      if (!match.isProcessed || !match.teamAId || !match.teamBId) {
        return false;
      }
      return (
        tiedTeamIds.has(match.teamAId) &&
        tiedTeamIds.has(match.teamBId) &&
        match.scoreA !== match.scoreB
      );
    });

    if (directMatches.length === 0) {
      return [...tiedTeams];
    }

    type H2HStats = {
      wins: number;
      mapsWon: number;
      mapsLost: number;
      matchesPlayed: number;
    };

    const h2hStats = new Map<string, H2HStats>();
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
      if (!teamAId || !teamBId) {
        continue;
      }

      const teamAStats = h2hStats.get(teamAId);
      const teamBStats = h2hStats.get(teamBId);

      if (!teamAStats || !teamBStats) {
        continue;
      }

      teamAStats.mapsWon += match.scoreA;
      teamAStats.mapsLost += match.scoreB;
      teamAStats.matchesPlayed += 1;

      teamBStats.mapsWon += match.scoreB;
      teamBStats.mapsLost += match.scoreA;
      teamBStats.matchesPlayed += 1;

      if (match.scoreA > match.scoreB) {
        teamAStats.wins += 1;
      } else {
        teamBStats.wins += 1;
      }
    }

    const allTeamsHaveH2H = tiedTeams.every(
      (team) => (h2hStats.get(team.teamId)?.matchesPlayed ?? 0) > 0,
    );
    if (!allTeamsHaveH2H) {
      return [...tiedTeams];
    }

    return [...tiedTeams].sort((a, b) => {
      const aStats = h2hStats.get(a.teamId);
      const bStats = h2hStats.get(b.teamId);

      if (!aStats || !bStats) {
        return a.teamId.localeCompare(b.teamId);
      }

      if (bStats.wins !== aStats.wins) {
        return bStats.wins - aStats.wins;
      }

      const aH2HMapDiff = aStats.mapsWon - aStats.mapsLost;
      const bH2HMapDiff = bStats.mapsWon - bStats.mapsLost;
      if (bH2HMapDiff !== aH2HMapDiff) {
        return bH2HMapDiff - aH2HMapDiff;
      }

      if (bStats.mapsWon !== aStats.mapsWon) {
        return bStats.mapsWon - aStats.mapsWon;
      }

      const overallMapDiffA = a.mapsWon - a.mapsLost;
      const overallMapDiffB = b.mapsWon - b.mapsLost;
      if (overallMapDiffB !== overallMapDiffA) {
        return overallMapDiffB - overallMapDiffA;
      }

      if (b.mapsWon !== a.mapsWon) {
        return b.mapsWon - a.mapsWon;
      }

      return a.teamId.localeCompare(b.teamId);
    });
  }

  findAllByTournament(tournamentId: string, stage?: Stage) {
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
