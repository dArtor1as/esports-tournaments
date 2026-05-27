import {
  BadRequestException,
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
import { TournamentSettings } from '../genetic-simulator/genetic-simulator.types';
import { RosterRole } from '@prisma/client';

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

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

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
    // ДОДАНО: players: true, щоб ми могли валідувати склад команди
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

    // 1. Формуємо єдиний формат ростера з урахуванням зворотньої сумісності
    let finalRoster: Array<{ playerId: string; role: RosterRole }> = [];

    if (dto.rosterPlayers && dto.rosterPlayers.length > 0) {
      finalRoster = dto.rosterPlayers.map((p) => ({
        playerId: p.playerId,
        role: p.role as RosterRole,
      }));
    } else if (dto.rosterPlayerIds && dto.rosterPlayerIds.length > 0) {
      finalRoster = dto.rosterPlayerIds.map((id) => ({
        playerId: id,
        role: (id === invite.team.captainId
          ? 'CAPTAIN'
          : 'PLAYER') as RosterRole,
      }));
    } else {
      throw new BadRequestException('Необхідно надати список гравців ростера.');
    }

    // перевіряємо, що всі гравці дійсно належать цій команді
    const teamPlayerIds = new Set(invite.team.players.map((p) => p.id));
    for (const roster of finalRoster) {
      if (!teamPlayerIds.has(roster.playerId)) {
        throw new BadRequestException(
          `Гравець з ID ${roster.playerId} не належить команді`,
        );
      }
    }

    // перевіряємо унікальність (щоб одного гравця не додали двічі)
    const uniqueIds = new Set(finalRoster.map((r) => r.playerId));
    if (uniqueIds.size !== finalRoster.length) {
      throw new BadRequestException(
        'Гравці у турнірному складі не повинні повторюватися',
      );
    }

    // 2. БІЗНЕС-ВАЛІДАЦІЯ РОСТЕРУ (Правила 5v5)
    const activeCount = finalRoster.filter(
      (r) => r.role === 'PLAYER' || r.role === 'CAPTAIN',
    ).length;
    const coachCount = finalRoster.filter((r) => r.role === 'COACH').length;
    const substituteCount = finalRoster.filter(
      (r) => r.role === 'SUBSTITUTE',
    ).length;

    if (activeCount !== 5) {
      throw new BadRequestException(
        `Для участі потрібно рівно 5 активних гравців (зараз обрано: ${activeCount}).`,
      );
    }
    if (coachCount > 1)
      throw new BadRequestException('У ростері може бути не більше 1 тренера.');
    if (substituteCount > 1)
      throw new BadRequestException(
        'У ростері може бути не більше 1 запасного гравця (Substitute).',
      );

    let settingsData: TournamentSettings =
      (invite.tournament.settings as unknown as TournamentSettings) || {};
    if (typeof invite.tournament.settings === 'string') {
      try {
        settingsData = JSON.parse(
          invite.tournament.settings,
        ) as TournamentSettings;
      } catch (error) {
        const trace = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Помилка парсингу JSON налаштувань для інвайту ${token}`,
          trace,
        );
        settingsData = {} as TournamentSettings;
      }
    }
    const initialStage =
      settingsData.bracketType === 'ROUND_ROBIN' ? 'GROUP' : 'PLAYOFF';

    // 3. Збереження в базі через транзакцію
    return this.prisma.$transaction(async (prismaTx) => {
      // Створюємо запис учасника турніру
      const participant = await prismaTx.tournamentParticipant.create({
        data: {
          tournamentId: invite.tournamentId,
          teamId: invite.teamId,
          seed: 99,
          joinedStage: initialStage,
        },
      });

      // Записуємо ростер із правильними ролями у БД
      const rosterData = finalRoster.map((p) => ({
        participantId: participant.id,
        playerId: p.playerId,
        role: p.role,
      }));

      await prismaTx.tournamentRoster.createMany({ data: rosterData });

      // Оновлюємо статус інвайту
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
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    // 3. Віддаємо інвайти
    return this.prisma.tournamentInvitation.findMany({
      where: { tournamentId },
      include: { team: { select: { name: true, tag: true } } },
    });
  }
}
