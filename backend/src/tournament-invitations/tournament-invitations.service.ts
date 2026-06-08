import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateTournamentInvitationDto } from './dto/create-tournament-invitation.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { InvitationPolicyService } from './invitation-policy.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { AcceptTournamentInvitationDto } from './dto/accept-tournament-invitation.dto';
import { TournamentInvitationsLogic } from './tournament-invitations.logic';

@Injectable()
export class TournamentInvitationsService {
  private readonly logger = new Logger(TournamentInvitationsService.name);
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

    if (tournament.creatorId !== user.userId) {
      throw new ForbiddenException(
        'Тільки організатор турніру може запрошувати команди',
      );
    }
    // перевірки перед створенням інвайту
    //  Перевірка регіонального обмеження для прямих інвайтів
    this.invitationPolicyService.checkRegionRestriction(
      team.region,
      tournament.region,
    );
    // Блокування нелогічних інвайтів (Tier різниця)
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

  async accept(
    token: string,
    dto: AcceptTournamentInvitationDto,
    user: JwtPayload,
  ) {
    const invite = await this.prisma.tournamentInvitation.findUnique({
      where: { token },
      include: {
        tournament: true,
        team: { include: { captain: true, players: true } },
      },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new BadRequestException('Запрошення недійсне або вже оброблене');
    }

    this.accessPolicy.checkCaptainOrAdmin(invite.team.captain.userId, user);

    // 1. Делегуємо валідацію та форматування ростеру
    const finalRoster = TournamentInvitationsLogic.validateAndFormatRoster(
      dto,
      invite.team.players,
      invite.team.captainId,
    );

    // 2. Делегуємо визначення початкової стадії
    const initialStage = TournamentInvitationsLogic.determineInitialStage(
      invite.tournament.settings,
      token,
    );

    // 3. Збереження в базі через транзакцію (Side-effects)
    return this.prisma.$transaction(async (prismaTx) => {
      const participant = await prismaTx.tournamentParticipant.create({
        data: {
          tournamentId: invite.tournamentId,
          teamId: invite.teamId,
          seed: 99,
          joinedStage: initialStage,
        },
      });

      const rosterData = finalRoster.map((p) => ({
        participantId: participant.id,
        playerId: p.playerId,
        role: p.role,
      }));

      await prismaTx.tournamentRoster.createMany({ data: rosterData });

      await prismaTx.tournamentInvitation.update({
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

    this.accessPolicy.checkCaptainOrAdmin(invite.team.captain.userId, user);

    return this.prisma.tournamentInvitation.update({
      where: { id: invite.id },
      data: { status: 'DECLINED' },
    });
  }
}
