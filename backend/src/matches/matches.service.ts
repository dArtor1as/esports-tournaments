import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { v4 as uuidv4 } from 'uuid';
import { Stage, Bracket } from '@prisma/client';
import {
  TeamForSeeding,
  HeuristicSeedingService,
} from './heuristic-seeding.service';

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
  bestOf: number;
}

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private seedingService: HeuristicSeedingService,
  ) {}

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

    const requestedTeamCount = dto.teamCount;
    const teamCount = requestedTeamCount ?? participants.length;

    if (requestedTeamCount && requestedTeamCount > participants.length) {
      throw new BadRequestException(
        `Недостатньо учасників для teamCount=${requestedTeamCount}. Зареєстровано: ${participants.length}.`,
      );
    }

    const selectedParticipants =
      requestedTeamCount && requestedTeamCount < participants.length
        ? participants.slice(0, requestedTeamCount)
        : participants;

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
          bestOf: tournament.format === 'TEAM' ? 3 : 1,
        };

        currentRoundMatches.push(match);
      }

      previousRoundMatches = currentRoundMatches;
      matchesToCreate.unshift(...currentRoundMatches);
    }

    const round1Matches = matchesToCreate.filter((m) => m.round === 1);

    for (let i = 0; i < teamCount / 2; i++) {
      round1Matches[i].teamAId = selectedParticipants[i].teamId;
      round1Matches[i].teamBId = selectedParticipants[teamCount - 1 - i].teamId;
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

  async generateGroupStage(dto: GenerateBracketDto) {
    const { tournamentId } = dto;
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    if (tournament.status !== 'planned') {
      throw new BadRequestException(
        'Групи вже згенеровані або турнір завершено',
      );
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { team: true }, // Нам потрібна інфа про команду для Elo та Регіону
      orderBy: { seed: 'asc' },
    });

    const requestedTeamCount = dto.teamCount;
    const teamCount = requestedTeamCount ?? participants.length;

    if (requestedTeamCount && requestedTeamCount > participants.length) {
      throw new BadRequestException(
        `Недостатньо учасників для teamCount=${requestedTeamCount}. Зареєстровано: ${participants.length}.`,
      );
    }

    const selectedParticipants =
      requestedTeamCount && requestedTeamCount < participants.length
        ? participants.slice(0, requestedTeamCount)
        : participants;

    const groupCount = dto.groupCount ?? 4;

    if (teamCount < 4) {
      throw new BadRequestException(
        `Для Group Stage потрібно щонайменше 4 команди. Зараз: ${teamCount}.`,
      );
    }

    if (teamCount % groupCount !== 0) {
      throw new BadRequestException(
        `Кількість команд (${teamCount}) має ділитися на кількість груп (${groupCount}) без остачі.`,
      );
    }

    if (teamCount / groupCount < 2) {
      throw new BadRequestException(
        `У кожній групі має бути щонайменше 2 команди. Зараз: ${teamCount / groupCount}.`,
      );
    }

    // 1. Готуємо дані для єврестичного балансувальника
    const teamsForSeeding: TeamForSeeding[] = selectedParticipants.map((p) => ({
      id: p.teamId,
      name: p.team.name,
      rating: p.team.averageRating,
      region: p.team.region,
    }));

    // 2. Запускаємо алгоритм для оптимального розбиття на вказану кількість груп
    const optimalGroups = this.seedingService.generateOptimalGroups(
      teamsForSeeding,
      groupCount,
    );

    const groupNames = Array.from({ length: groupCount }, (_, i) => {
      const charCode = 65 + i;
      return `Group ${String.fromCharCode(charCode)}`;
    });
    const matchesToCreate: MatchPayload[] = [];

    // 3. Формуємо матчі на основі результатів еволюції
    optimalGroups.forEach((groupTeams, groupIndex) => {
      const groupName = groupNames[groupIndex];

      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          matchesToCreate.push({
            id: uuidv4(),
            tournamentId,
            stage: Stage.GROUP,
            bracket: Bracket.NONE,
            groupName: groupName,
            round: 1,
            teamAId: groupTeams[i].id,
            teamBId: groupTeams[j].id,
            bestOf: tournament.format === 'TEAM' ? 3 : 1, // Приклад використання формату
            nextMatchWinnerId: null,
          });
        }
      }
    });

    return this.prisma.$transaction(async (prisma) => {
      await prisma.match.createMany({ data: matchesToCreate });

      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'live' },
      });

      return {
        message: `Згенеровано ${matchesToCreate.length} матчів. Групи збалансовано евристичним алгоритмом.`,
        groupsDistribution: optimalGroups.map((group, idx) => ({
          group: groupNames[idx],
          teams: group.map(
            (t) => `${t.name} (Elo: ${t.rating}, Reg: ${t.region})`,
          ),
        })),
      };
    });
  }
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
    const groupParticipants = participants.filter((p) => teamGroupMap.has(p.teamId));

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

    // Сортуємо переможців груп та другі місця для формування посівів (seeds)
    this.sortGroupTeams(firstPlaces);
    this.sortGroupTeams(secondPlaces);

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
