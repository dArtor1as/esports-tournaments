import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { MatchesProgressionService } from './matches-progression.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import { DisputeMatchDto, ReportScoreDto } from './dto/consensus.dto';
import { AccessPolicyService } from '../auth/access-policy.service';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class MatchesConsensusService {
  constructor(
    private prisma: PrismaService,
    private statsService: StatsService,
    private progressionService: MatchesProgressionService,
    private accessPolicy: AccessPolicyService,
    private mailService: MailService,
  ) {}

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

    // 1. Визначаємо , чи діє капітан
    const isCaptainA = match.teamA?.captain.userId === user.userId;
    const isCaptainB = match.teamB?.captain.userId === user.userId;

    if (isCaptainA) {
      isTeamAForfeiting = true;
    } else if (isCaptainB) {
      isTeamBForfeiting = true;
    } else {
      // 2. Якщо це не капітан, перевіряємо права Організатора або Адміна через AccessPolicy
      this.accessPolicy.checkTournamentCreatorOrAdmin(
        match.tournament.creatorId,
        user,
      );

      // Якщо виклик вище не кинув ForbiddenException, значить це адмін/креатор
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
    }

    // 3. Визначаємо рахунок (Технічна перемога залежить від формату: 1:0, 2:0 або 3:0)
    const pointsToWin = Math.ceil(match.bestOf / 2);
    const scoreA = isTeamAForfeiting ? 0 : pointsToWin;
    const scoreB = isTeamAForfeiting ? pointsToWin : 0;

    await this.prisma.$transaction(async (prismaTx) => {
      // Викликаємо публічний метод з Progression Service
      await this.progressionService.finalizeMatchProgression(
        prismaTx,
        match,
        scoreA,
        scoreB,
      );
    });

    await this.statsService.processTournamentStats(match.tournamentId);
    return { message: 'Технічна поразка зарахована. Elo оновлено.' };
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

    await this.prisma.$transaction(async (prismaTx) => {
      // Викликаємо progressionService
      await this.progressionService.finalizeMatchProgression(
        prismaTx,
        match,
        match.reportedScoreA!,
        match.reportedScoreB!,
      );
    });

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
        tournament: { include: { creator: true } },
      },
    });

    if (match?.matchStatus !== 'REPORTED')
      throw new BadRequestException('Неможливо оскаржити');
    if (match.reportedById === user.userId)
      throw new BadRequestException('Ви не можете оскаржити власний звіт');

    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        matchStatus: 'DISPUTED',
        disputeReason: dto.reason,
      },
    });

    // --- ВІДПРАВЛЯЄМО ЛИСТ ТВОРЦЮ ---
    if (match.tournament.creator?.email) {
      // Відправляємо асинхронно, щоб не блокувати відповідь клієнту
      this.mailService
        .sendMatchDisputeNotification(
          match.tournament.creator.email,
          match.tournament.title,
          match.id,
          dto.reason || 'Причину не вказано',
        )
        .catch((err) =>
          console.error('Помилка відправки листа про диспут:', err),
        );
    }
    return updatedMatch;
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

    this.accessPolicy.checkTournamentCreatorOrAdmin(
      match.tournament.creatorId,
      user,
    );

    await this.prisma.$transaction(async (prismaTx) => {
      await this.progressionService.finalizeMatchProgression(
        prismaTx,
        match,
        dto.scoreA,
        dto.scoreB,
      );
      await prismaTx.match.update({
        where: { id: matchId },
        data: { disputeReason: null },
      });
    });

    await this.statsService.processTournamentStats(match.tournamentId);
    return { message: 'Матч примусово закрито. Elo нараховано.' };
  }
}
