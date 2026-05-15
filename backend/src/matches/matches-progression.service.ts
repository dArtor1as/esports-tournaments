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
      const sortedGroup = this.sortGroupTeams(groupedParticipants[groupName]);

      if (sortedGroup[0]) firstPlaces.push(sortedGroup[0]);
      if (sortedGroup[1]) secondPlaces.push(sortedGroup[1]);
    }

    // Сортуємо переможців груп та другі місця для формування підсумкових посівів
    this.sortGroupTeams(firstPlaces);
    this.sortGroupTeams(secondPlaces);

    const playoffTeams = [...firstPlaces, ...secondPlaces];

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
  // Пріоритет: 1) Очки, 2) Різниця виграних/програних карт.
  private sortGroupTeams<
    T extends { groupPoints: number; mapsWon: number; mapsLost: number },
  >(teams: T[]): T[] {
    return teams.sort((a, b) => {
      if (b.groupPoints !== a.groupPoints) {
        return b.groupPoints - a.groupPoints;
      }
      const mapDiffA = a.mapsWon - a.mapsLost;
      const mapDiffB = b.mapsWon - b.mapsLost;
      return mapDiffB - mapDiffA;
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
