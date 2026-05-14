import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTournamentInvitationDto } from './dto/create-tournament-invitation.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { InvitationPolicyService } from './invitation-policy.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Injectable()
export class TournamentInvitationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private invitationPolicyService: InvitationPolicyService,
    private accessPolicy: AccessPolicyService,
  ) {}

  async create(dto: CreateTournamentInvitationDto, user: JwtPayload) {
    // 1. Отримуємо дані турніру та команди для аналізу логіки
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
    });

    if (!tournament || !team)
      throw new NotFoundException('Турнір або команда не знайдені');

    //  Перевірка відповідності гри команди та турніру
    if (tournament.gameId !== team.gameId) {
      throw new BadRequestException(
        'Команда та турнір належать до різних ігрових ігор',
      );
    }

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    // перевірки перед створенням інвайту
    // ПРАВИЛО 1: Блокування нелогічних інвайтів (Tier різниця)
    this.invitationPolicyService.checkTierDifference(
      team.tier,
      tournament.tier,
    );

    const currentParticipants = await this.prisma.tournamentParticipant.count({
      where: { tournamentId: dto.tournamentId },
    });
    const pendingInvites = await this.prisma.tournamentInvitation.count({
      where: { tournamentId: dto.tournamentId, status: 'PENDING' },
    });
    // ПРАВИЛО 2: Контроль ліміту місць
    this.invitationPolicyService.checkCapacity(
      currentParticipants,
      pendingInvites,
      tournament.maxParticipants,
    );

    const existingParticipant =
      await this.prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_teamId: {
            tournamentId: dto.tournamentId,
            teamId: dto.teamId,
          },
        },
      });
    const existingInvite = await this.prisma.tournamentInvitation.findFirst({
      where: {
        tournamentId: dto.tournamentId,
        teamId: dto.teamId,
        status: 'PENDING',
      },
    });
    // ПРАВИЛО 3: Перевірка на дублікати
    this.invitationPolicyService.checkDuplicates(
      existingParticipant,
      existingInvite,
    );

    // 2. Створюємо інвайт
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.prisma.tournamentInvitation.create({
      data: {
        tournamentId: dto.tournamentId,
        teamId: dto.teamId,
        token,
        expiresAt,
      },
      include: {
        tournament: true,
        team: {
          include: {
            captain: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    // 3. Відправляємо листа з посиланням для прийняття запрошення
    await this.mailService.sendTournamentInvite(
      invite.team.captain.user.email,
      invite.tournament.title,
      invite.team.name,
      token,
    );

    return {
      message: 'Запрошення успішно надіслано на пошту капітана',
      inviteId: invite.id,
    };
  }

  async accept(token: string, rosterPlayerIds: string[], user: JwtPayload) {
    return this.prisma.$transaction(async (prisma) => {
      // 1. Валідація інвайту
      const invite = await prisma.tournamentInvitation.findUnique({
        where: { token },
        include: {
          tournament: true,
          team: {
            include: {
              captain: true,
            },
          },
        },
      });
      if (!invite) throw new NotFoundException('Запрошення не знайдено');

      if (invite.status !== 'PENDING')
        throw new BadRequestException('Запрошення вже оброблено');

      if (invite.expiresAt < new Date())
        throw new BadRequestException('Термін дії запрошення минув');

      if (invite.team.captain.userId !== user.userId)
        throw new ForbiddenException('Ви не є капітаном цієї команди');

      // 2. Валідація гравців
      const players = await prisma.player.findMany({
        where: { id: { in: rosterPlayerIds }, teamId: invite.teamId },
      });
      if (players.length !== rosterPlayerIds.length) {
        throw new BadRequestException(
          'Деякі гравці не знайдені або не належать цій команді',
        );
      }

      // 3. Визначаємо стадію, на яку потрапляє команда (CQ або GROUP) та створюємо учасника турніру
      const assignedStage = this.invitationPolicyService.determineAssignedStage(
        invite.team.tier,
        invite.tournament.tier,
      );

      const participantCount = await prisma.tournamentParticipant.count({
        where: { tournamentId: invite.tournamentId },
      });

      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: invite.tournamentId,
          teamId: invite.teamId,
          joinedStage: assignedStage as any,
          seed: participantCount + 1,
        },
      });

      const rosterData = rosterPlayerIds.map((playerId) => ({
        participantId: participant.id,
        playerId: playerId,
        role: 'PLAYER' as const,
      }));
      await prisma.tournamentRoster.createMany({ data: rosterData });

      await prisma.tournamentInvitation.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });

      return participant;
    });
  }

  // Капітан відхиляє запрошення, статус інвайту змінюється на DECLINED
  async decline(token: string, user: JwtPayload) {
    const invite = await this.prisma.tournamentInvitation.findUnique({
      where: { token },
      include: {
        team: {
          include: { captain: true },
        },
      },
    });

    if (!invite || invite.status !== 'PENDING')
      throw new BadRequestException('Запрошення недійсне');

    if (invite.team.captain.userId !== user.userId)
      throw new ForbiddenException('Ви не є капітаном цієї команди');

    return this.prisma.tournamentInvitation.update({
      where: { id: invite.id },
      data: { status: 'DECLINED' },
    });
  }
  async findMyTeamInvites(userId: string) {
    return this.prisma.tournamentInvitation.findMany({
      where: {
        status: 'PENDING',
        team: {
          captain: { userId }, // Тільки ті команди, де юзер — капітан
        },
        expiresAt: { gt: new Date() },
      },
      include: {
        tournament: { select: { title: true, region: true, tier: true } },
        team: { select: { name: true, tag: true } },
      },
    });
  }

  async findAllByTournament(tournamentId: string, user: JwtPayload) {
    // 1. Шукаємо турнір, щоб дізнатися, хто його створив
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { creatorId: true },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    // 2. Перевіряємо, чи це творець турніру або Адмін
    if (tournament.creatorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Ви не маєте доступу до списку запрошень цього турніру',
      );
    }

    // 3. Віддаємо інвайти
    return this.prisma.tournamentInvitation.findMany({
      where: { tournamentId },
      include: { team: { select: { name: true, tag: true } } },
    });
  }
}
