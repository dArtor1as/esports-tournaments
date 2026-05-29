import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { MatchesProgressionService } from './matches-progression.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import { DisputeMatchDto, ReportScoreDto } from './dto/consensus.dto';
import { MailService } from 'src/mail/mail.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MatchesConsensusLogic } from './matches-consensus.logic';
@Injectable()
export class MatchesConsensusService {
  constructor(
    private prisma: PrismaService,
    private statsService: StatsService,
    private progressionService: MatchesProgressionService,
    private mailService: MailService,
    private consensusLogic: MatchesConsensusLogic,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async clearMatchCaches(matchId: string, tournamentId: string) {
    await this.cacheManager.del(`/matches/${matchId}`);
    await this.cacheManager.del(`/matches/tournament/${tournamentId}`);
    await this.cacheManager.del(`/tournaments/${tournamentId}`);
  }

  private async getConsensusMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { include: { creator: true } },
        teamA: { include: { captain: true } },
        teamB: { include: { captain: true } },
      },
    });

    if (!match) throw new NotFoundException('Матч не знайдено');
    return match;
  }

  async forfeitMatch(matchId: string, dto: ForfeitMatchDto, user: JwtPayload) {
    const match = await this.getConsensusMatch(matchId);

    // Чиста логіка віддає нам готовий рахунок
    const { scoreA, scoreB } = this.consensusLogic.resolveForfeit(
      match,
      dto,
      user,
    );

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

    await this.clearMatchCaches(match.id, match.tournamentId);
    return { message: 'Технічна поразка зарахована. Elo оновлено.' };
  }

  //  1. внесення рахунку (REPORT)
  async reportMatch(matchId: string, dto: ReportScoreDto, user: JwtPayload) {
    const match = await this.getConsensusMatch(matchId);

    // Чиста валідація
    this.consensusLogic.validateReport(match, user);

    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        reportedScoreA: dto.scoreA,
        reportedScoreB: dto.scoreB,
        reportedById: user.userId,
        matchStatus: 'REPORTED',
      },
    });

    await this.clearMatchCaches(match.id, match.tournamentId);
    return updatedMatch;
  }

  //  2. підтвердження рахунку (CONFIRM)
  async confirmMatch(matchId: string, user: JwtPayload) {
    const match = await this.getConsensusMatch(matchId);

    // Чиста валідація
    this.consensusLogic.validateConfirm(match, user);

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

    await this.clearMatchCaches(match.id, match.tournamentId);
    return { message: 'Рахунок підтверджено. Elo нараховано.' };
  }

  //  3. оскарження (DISPUTE)
  async disputeMatch(matchId: string, dto: DisputeMatchDto, user: JwtPayload) {
    const match = await this.getConsensusMatch(matchId);

    // Чиста валідація
    this.consensusLogic.validateDispute(match, user);

    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: { matchStatus: 'DISPUTED', disputeReason: dto.reason },
    });

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

    await this.clearMatchCaches(match.id, match.tournamentId);
    return updatedMatch;
  }

  //  4. примусове рішення адміна (FORCE RESOLVE)
  async forceResolveMatch(
    matchId: string,
    dto: ReportScoreDto,
    user: JwtPayload,
  ) {
    const match = await this.getConsensusMatch(matchId);

    // Чиста валідація
    this.consensusLogic.validateForceResolve(match, user);

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

    await this.clearMatchCaches(match.id, match.tournamentId);
    return { message: 'Матч примусово закрито. Elo нараховано.' };
  }
}
