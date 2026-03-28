import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { v4 as uuidv4 } from 'uuid';
import { Stage, Bracket } from '@prisma/client';

// Додаємо інтерфейс, щоб TypeScript знав, як виглядає наш об'єкт матчу
interface MatchPayload {
  id: string;
  tournamentId: string;
  stage: Stage;
  bracket: Bracket;
  groupName?: string | null; // Додано для групового етапу
  round: number;
  nextMatchWinnerId: string | null;
  teamAId: string | null;
  teamBId: string | null;
}

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  async generateSingleElimination(dto: GenerateBracketDto) {
    const { tournamentId } = dto;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    if (tournament.status === 'finished') {
      throw new BadRequestException('Турнір вже завершено');
    }

    // Перевіряємо, чи ще не згенеровано плей-оф
    const existingPlayoffMatches = await this.prisma.match.count({
      where: { tournamentId, stage: Stage.PLAYOFF },
    });
    if (existingPlayoffMatches > 0) {
      throw new BadRequestException('Сітка плей-оф вже згенерована');
    }

    // Відбираємо тільки тих, хто пройшов (Топ-8 мають seed від 1 до 8)
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: {
        tournamentId,
        seed: { lte: 32 },
      },
      orderBy: { seed: 'asc' },
    });

    const teamCount = participants.length;

    if (teamCount < 2 || !Number.isInteger(Math.log2(teamCount))) {
      throw new BadRequestException(
        `Для Single Elimination кількість команд має бути 2, 4, 8, 16 тощо. Зараз: ${teamCount}`,
      );
    }

    const totalRounds = Math.log2(teamCount);

    // вказуємо типи для масивів
    const matchesToCreate: MatchPayload[] = [];
    let previousRoundMatches: MatchPayload[] = [];

    for (let round = totalRounds; round >= 1; round--) {
      const matchCountInRound = Math.pow(2, totalRounds - round);

      // Явно вказуємо тип
      const currentRoundMatches: MatchPayload[] = [];

      for (let i = 0; i < matchCountInRound; i++) {
        const matchId = uuidv4();
        let nextMatchId: string | null = null;

        // Явно вказуємо, що тип - це весь Enum, а не тільки UPPER
        let bracketType: Bracket = Bracket.UPPER;

        if (round === totalRounds) {
          bracketType = Bracket.GRAND_FINAL;
        }

        if (round < totalRounds) {
          const parentIndex = Math.floor(i / 2);
          nextMatchId = previousRoundMatches[parentIndex].id;
        }

        const match: MatchPayload = {
          id: matchId,
          tournamentId,
          stage: Stage.PLAYOFF,
          bracket: bracketType,
          round,
          nextMatchWinnerId: nextMatchId,
          teamAId: null,
          teamBId: null,
        };

        currentRoundMatches.push(match);
      }

      previousRoundMatches = currentRoundMatches;
      matchesToCreate.unshift(...currentRoundMatches);
    }

    const round1Matches = matchesToCreate.filter((m) => m.round === 1);

    for (let i = 0; i < teamCount / 2; i++) {
      round1Matches[i].teamAId = participants[i].teamId;
      round1Matches[i].teamBId = participants[teamCount - 1 - i].teamId;
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.match.createMany({ data: matchesToCreate });

      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'live' },
      });

      return prisma.match.findMany({
        where: { tournamentId },
        orderBy: [{ round: 'asc' }],
        include: {
          teamA: { select: { tag: true } },
          teamB: { select: { tag: true } },
        },
      });
    });
  }

  async generateGroupStage(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    if (tournament.status !== 'planned')
      throw new BadRequestException(
        'Групи вже згенеровані або турнір завершено',
      );

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      orderBy: { seed: 'asc' }, // Сортуємо за посівом (або рейтингом) для рівномірного розподілу
    });

    if (participants.length !== 16) {
      // поки зробимо жорстку перевірку на 16 команд, оскільки це стандарт для групового етапу з 4 групами по 4 команди
      throw new BadRequestException(
        `Для цього формату потрібно рівно 16 команд. Зараз: ${participants.length}`,
      );
    }

    // Створюємо 4 групи
    const groupNames = ['Group A', 'Group B', 'Group C', 'Group D'];
    const groups: Record<string, string[]> = {
      'Group A': [],
      'Group B': [],
      'Group C': [],
      'Group D': [],
    };

    // Розподіляємо команди "змійкою" (щоб збалансувати групи за силою)
    // 1-й йде в А, 2-й в B, 3-й в C, 4-й в D, 5-й знову в D і т.д.
    participants.forEach((p, index) => {
      const groupIndex =
        Math.floor(index / 4) % 2 === 0
          ? index % 4 // Зліва направо: 0, 1, 2, 3
          : 3 - (index % 4); // Справа наліво : 3, 2, 1, 0

      groups[groupNames[groupIndex]].push(p.teamId);
    });

    const matchesToCreate: MatchPayload[] = [];

    // Генеруємо матчі (Кожен з кожним ТІЛЬКИ всередині своєї групи)
    for (const groupName of groupNames) {
      const teamIds = groups[groupName];

      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
          matchesToCreate.push({
            id: uuidv4(),
            tournamentId,
            stage: Stage.GROUP,
            bracket: Bracket.NONE,
            groupName: groupName,
            round: 1,
            teamAId: teamIds[i],
            teamBId: teamIds[j],
            nextMatchWinnerId: null,
          });
        }
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.match.createMany({ data: matchesToCreate });

      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'live' },
      });

      return {
        message: `Згенеровано ${matchesToCreate.length} матчів для 4-х груп (по 6 матчів у кожній).`,
        groupsDistribution: groups, // Виводимо розподіл для перевірки
      };
    });
  }

  async transitionToPlayoffs(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    // Витягуємо всі матчі групи для визначення приналежності команд до груп
    const groupMatches = await this.prisma.match.findMany({
      where: { tournamentId, stage: Stage.GROUP },
      select: { teamAId: true, teamBId: true, groupName: true },
    });

    if (!groupMatches.length) {
      throw new BadRequestException('Групові матчі не знайдені');
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { team: { select: { tag: true } } },
    });

    // Мапимо команди до їхніх груп
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

    for (const p of participants) {
      const groupName = teamGroupMap.get(p.teamId) || 'Unknown';
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
      const sortedGroup = groupedParticipants[groupName].sort((a, b) => {
        if (b.groupPoints !== a.groupPoints) {
          return b.groupPoints - a.groupPoints;
        }
        const mapDiffA = a.mapsWon - a.mapsLost;
        const mapDiffB = b.mapsWon - b.mapsLost;
        return mapDiffB - mapDiffA;
      });

      if (sortedGroup[0]) firstPlaces.push(sortedGroup[0]);
      if (sortedGroup[1]) secondPlaces.push(sortedGroup[1]);
    }

    // Сортуємо 1-ші місця між собою для призначення посівів 1-4
    firstPlaces.sort((a, b) => {
      if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
      return b.mapsWon - b.mapsLost - (a.mapsWon - a.mapsLost);
    });

    // Сортуємо 2-гі місця між собою для призначення посівів 5-8
    secondPlaces.sort((a, b) => {
      if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
      return b.mapsWon - b.mapsLost - (a.mapsWon - a.mapsLost);
    });

    const playoffTeams = [...firstPlaces, ...secondPlaces];

    // Оновлюємо посіви в базі даних
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

  findAllByTournament(tournamentId: string, stage?: Stage) {
    const whereCondition: any = { tournamentId };

    // Якщо передано параметр stage (наприклад, 'GROUP' або 'PLAYOFF'), фільтруємо за ним
    if (stage) {
      whereCondition.stage = stage;
    }
    return this.prisma.match.findMany({
      where: whereCondition,
      // Сортуємо спочатку за стадією (щоб групи йшли першими),
      // потім за групою (якщо є), потім за раундом
      orderBy: [{ stage: 'asc' }, { groupName: 'asc' }, { round: 'asc' }],
      include: {
        teamA: { select: { id: true, name: true, tag: true, logoUrl: true } },
        teamB: { select: { id: true, name: true, tag: true, logoUrl: true } },
        nextMatchWinner: { select: { id: true, round: true } },
      },
    });
  }
}
