import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { Prisma, Stage } from '@prisma/client';
import { SingleEliminationGenerator } from './generators/single-elimination.generator';
import { DoubleEliminationGenerator } from './generators/double-elimination.generator';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import { ReportScoreDto } from './dto/report-score.dto';
import { DisputeMatchDto } from './dto/consensus.dto';
import { StatsService } from 'src/stats/stats.service';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private singleEliminationGenerator: SingleEliminationGenerator,
    private doubleEliminationGenerator: DoubleEliminationGenerator,
    private groupStageGenerator: GroupStageGenerator,
    private statsService: StatsService,
  ) {}

  /**
   * Маршрутизатор для генерації сітки Плей-оф.
   * Читає налаштування турніру та делегує створення матчу відповідній стратегії.
   */
  async generateBracket(dto: GenerateBracketDto) {
    const { tournamentId } = dto;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    if (tournament.status === 'finished') {
      throw new BadRequestException('Турнір вже завершено');
    }

    const existingPlayoffMatches = await this.prisma.match.count({
      where: { tournamentId, stage: Stage.PLAYOFF },
    });
    if (existingPlayoffMatches > 0) {
      throw new BadRequestException('Сітка плей-оф вже згенерована');
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId, seed: { lte: 32 } },
      orderBy: { seed: 'asc' },
    });

    const requestedTeamCount = dto.teamCount;
    const teamCount = requestedTeamCount ?? participants.length;

    if (requestedTeamCount && requestedTeamCount > participants.length) {
      throw new BadRequestException(
        `Недостатньо учасників. Зареєстровано: ${participants.length}.`,
      );
    }

    if (teamCount < 4 || !Number.isInteger(Math.log2(teamCount))) {
      throw new BadRequestException(
        `Кількість команд має бути 4, 8, 16, 32 тощо. Зараз: ${teamCount}`,
      );
    }

    const selectedParticipants =
      requestedTeamCount && requestedTeamCount < participants.length
        ? participants.slice(0, requestedTeamCount)
        : participants;

    // Безпечний парсинг налаштувань турніру для визначення формату сітки
    let settingsData: any = tournament.settings || {};
    if (typeof settingsData === 'string') {
      try {
        settingsData = JSON.parse(settingsData);
      } catch (e) {}
    }
    const bracketType = settingsData?.bracketType;

    // Делегування генерації
    if (bracketType === 'DOUBLE_ELIMINATION') {
      return this.doubleEliminationGenerator.generate(
        tournamentId,
        teamCount,
        selectedParticipants,
        tournament.format,
      );
    }

    return this.singleEliminationGenerator.generate(
      tournamentId,
      teamCount,
      selectedParticipants,
      tournament.format,
    );
  }

  /**
   * Делегує генерацію кругової системи (Round Robin) для групового етапу
   */
  async generateGroupStage(dto: GenerateBracketDto) {
    const { tournamentId, groupCount = 4 } = dto;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    if (tournament.status !== 'planned') {
      throw new BadRequestException(
        'Групи вже згенеровані або турнір завершено',
      );
    }

    const existingGroupMatches = await this.prisma.match.count({
      where: { tournamentId, stage: Stage.GROUP },
    });
    if (existingGroupMatches > 0) {
      throw new BadRequestException('Груповий етап вже згенеровано');
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { team: true },
      orderBy: { seed: 'asc' },
    });

    const teamCount = dto.teamCount ?? participants.length;

    if (teamCount < 4) {
      throw new BadRequestException(
        'Для групового етапу потрібно мінімум 4 команди',
      );
    }

    const selectedParticipants = participants.slice(0, teamCount);

    return this.groupStageGenerator.generate(
      tournamentId,
      teamCount,
      selectedParticipants,
      tournament.format,
      groupCount,
    );
  }

  /**
   * Допоміжний метод для сортування команд усередині групи.
   * Пріоритет: 1) Очки, 2) Різниця виграних/програних карт.
   */
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

  /**
   * Аналізує результати групового етапу, визначає Топ-2 команди кожної групи
   * та оновлює їхні посіви (seed) для подальшої участі у Плей-оф.
   */
  async transitionToPlayoffs(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');

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
  async forfeitMatch(matchId: string, dto: ForfeitMatchDto, user: JwtPayload) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        teamA: { include: { captain: true } },
        teamB: { include: { captain: true } },
      },
    });

    if (!match) throw new NotFoundException('Матч не знайдено');
    if (match.isProcessed)
      throw new BadRequestException('Цей матч вже завершено');
    if (match.tournament.status !== 'live')
      throw new BadRequestException('Турнір не активний');
    if (!match.teamAId || !match.teamBId)
      throw new BadRequestException(
        'В цьому матчі ще не визначені обидва опоненти',
      );

    let isTeamAForfeiting = false;
    let isTeamBForfeiting = false;

    // 1. Визначаємо ролі
    const isCaptainA = match.teamA?.captain.userId === user.userId;
    const isCaptainB = match.teamB?.captain.userId === user.userId;
    const isAdminOrCreator =
      user.role === 'ADMIN' || match.tournament.creatorId === user.userId;

    // 2. Логіка визначення "хто здається"
    if (isCaptainA) {
      isTeamAForfeiting = true;
    } else if (isCaptainB) {
      isTeamBForfeiting = true;
    } else if (isAdminOrCreator) {
      // Якщо це адмін/організатор, він ЗОБОВ'ЯЗАНИЙ передати forfeitingTeamId
      if (!dto.forfeitingTeamId) {
        throw new BadRequestException(
          'Адміністратор або Організатор повинен вказати ID команди, яку дискваліфікують (forfeitingTeamId)',
        );
      }

      if (dto.forfeitingTeamId === match.teamAId) {
        isTeamAForfeiting = true;
      } else if (dto.forfeitingTeamId === match.teamBId) {
        isTeamBForfeiting = true;
      } else {
        throw new BadRequestException(
          'Вказана команда не бере участі в цьому матчі',
        );
      }
    } else {
      throw new ForbiddenException(
        'Тільки капітан команди, адміністратор або організатор турніру може зарахувати технічну поразку',
      );
    }

    // 3. Визначаємо рахунок (Технічна перемога залежить від формату: 1:0, 2:0 або 3:0)
    const pointsToWin = Math.ceil(match.bestOf / 2);
    const scoreA = isTeamAForfeiting ? 0 : pointsToWin;
    const scoreB = isTeamAForfeiting ? pointsToWin : 0;

    await this.prisma.$transaction(async (tx) => {
      await this.finalizeMatchProgression(tx, match, scoreA, scoreB);
    });

    // 4. Рахуємо Elo!
    await this.statsService.processTournamentStats(match.tournamentId);

    return { message: 'Технічна поразка зарахована. Elo оновлено.' };
  }

  // Допоміжний метод для безпечного завершення матчу і просування по сітці
  private async finalizeMatchProgression(
    tx: Prisma.TransactionClient,
    match: any,
    scoreA: number,
    scoreB: number,
  ) {
    const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId;
    const loserId = scoreA > scoreB ? match.teamBId : match.teamAId;

    const updatedMatch = await tx.match.update({
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
      const nextMatch = await tx.match.findUnique({
        where: { id: match.nextMatchWinnerId },
      });
      if (nextMatch) {
        if (!nextMatch.teamAId)
          await tx.match.update({
            where: { id: nextMatch.id },
            data: { teamAId: winnerId },
          });
        else
          await tx.match.update({
            where: { id: nextMatch.id },
            data: { teamBId: winnerId },
          });
      }
    }

    // Просування переможеного (Нижня сітка Double Elim)
    if (match.nextMatchLoserId && loserId) {
      const nextLoserMatch = await tx.match.findUnique({
        where: { id: match.nextMatchLoserId },
      });
      if (nextLoserMatch) {
        if (!nextLoserMatch.teamAId)
          await tx.match.update({
            where: { id: nextLoserMatch.id },
            data: { teamAId: loserId },
          });
        else
          await tx.match.update({
            where: { id: nextLoserMatch.id },
            data: { teamBId: loserId },
          });
      }
    }

    return updatedMatch;
  }

  //  1. внесення рахунку (REPORT)
  async reportMatch(matchId: string, dto: ReportScoreDto, user: JwtPayload) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { include: { captain: true } },
        teamB: { include: { captain: true } },
      },
    });

    if (!match || match.matchStatus === 'COMPLETED')
      throw new BadRequestException('Матч недоступний для звітування');

    const isCaptainA = match.teamA?.captain.userId === user.userId;
    const isCaptainB = match.teamB?.captain.userId === user.userId;

    if (!isCaptainA && !isCaptainB)
      throw new ForbiddenException('Тільки капітани можуть вносити рахунок');

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        reportedScoreA: dto.scoreA,
        reportedScoreB: dto.scoreB,
        reportedById: user.userId,
        matchStatus: 'REPORTED',
      },
    });
  }

  //  2. підтвердження (CONFIRM)
  async confirmMatch(matchId: string, user: JwtPayload) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { include: { captain: true } },
        teamB: { include: { captain: true } },
      },
    });

    if (match?.matchStatus !== 'REPORTED')
      throw new BadRequestException('Немає рахунку для підтвердження');

    const isCaptainA = match.teamA?.captain.userId === user.userId;
    const isCaptainB = match.teamB?.captain.userId === user.userId;

    if (!isCaptainA && !isCaptainB)
      throw new ForbiddenException('Тільки капітан може підтвердити');
    if (match.reportedById === user.userId)
      throw new BadRequestException(
        'Ви не можете підтвердити власний звіт. Чекайте на опонента.',
      );

    await this.prisma.$transaction(async (tx) => {
      await this.finalizeMatchProgression(
        tx,
        match,
        match.reportedScoreA!,
        match.reportedScoreB!,
      );
    });

    // 2. Рахуємо Elo та оновлюємо статистику турніру
    await this.statsService.processTournamentStats(match.tournamentId);

    return { message: 'Рахунок підтверджено. Elo нараховано.' };
  }

  //  3. оскарження (DISPUTE)
  async disputeMatch(matchId: string, dto: DisputeMatchDto, user: JwtPayload) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { include: { captain: true } },
        teamB: { include: { captain: true } },
      },
    });

    if (match?.matchStatus !== 'REPORTED')
      throw new BadRequestException('Неможливо оскаржити');
    if (match.reportedById === user.userId)
      throw new BadRequestException('Ви не можете оскаржити власний звіт');

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        matchStatus: 'DISPUTED',
        disputeReason: dto.reason,
      },
    });
  }

  //  4. примусове рішення адміна (FORCE RESOLVE)
  async forceResolveMatch(
    matchId: string,
    dto: ReportScoreDto,
    user: JwtPayload,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match || match.matchStatus === 'COMPLETED')
      throw new BadRequestException('Матч вже закритий');

    if (match.tournament.creatorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Тільки організатор або адмін може примусово закрити матч',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.finalizeMatchProgression(tx, match, dto.scoreA, dto.scoreB);
      // Очищаємо причину диспуту
      await tx.match.update({
        where: { id: matchId },
        data: { disputeReason: null },
      });
    });

    // Рахуємо Elo!
    await this.statsService.processTournamentStats(match.tournamentId);

    return { message: 'Матч примусово закрито. Elo нараховано.' };
  }

  findAllByTournament(tournamentId: string, stage?: Stage) {
    const whereCondition: any = { tournamentId };

    if (stage) {
      whereCondition.stage = stage;
    }

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
