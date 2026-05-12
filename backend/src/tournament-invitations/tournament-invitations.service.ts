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

@Injectable()
export class TournamentInvitationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(dto: CreateTournamentInvitationDto) {
    // 1. Отримуємо дані турніру та команди для аналізу логіки
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
    });

    if (!tournament || !team)
      throw new NotFoundException('Турнір або команда не знайдені');

    // --- ПРАВИЛО 1: Блокування нелогічних інвайтів (Tier різниця) ---
    // Чим менша цифра тіру, тим сильніша команда (1 - Pro, 3 - Amateur).
    // Тобто, якщо team.tier (3) - tournament.tier (1) > 1 -> це порушення.
    const tierDifference = team.tier - tournament.tier;

    if (tierDifference > 1) {
      throw new BadRequestException(
        `Команда Tier ${team.tier} занадто слабка для отримання прямого запрошення на турнір Tier ${tournament.tier}. Вони мають проходити Відкриті Кваліфікації.`,
      );
    }

    // --- ПРАВИЛО 2: Контроль ліміту місць ---
    const currentParticipants = await this.prisma.tournamentParticipant.count({
      where: { tournamentId: dto.tournamentId },
    });
    const pendingInvites = await this.prisma.tournamentInvitation.count({
      where: { tournamentId: dto.tournamentId, status: 'PENDING' },
    });

    if (currentParticipants + pendingInvites >= tournament.maxParticipants) {
      throw new BadRequestException(
        'На турнірі більше немає вільних слотів (враховуючи вже надіслані запрошення)',
      );
    }

    // 3. Перевірки на дублікати
    const existingParticipant =
      await this.prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_teamId: {
            tournamentId: dto.tournamentId,
            teamId: dto.teamId,
          },
        },
      });
    if (existingParticipant)
      throw new BadRequestException('Команда вже бере участь у цьому турнірі');

    const existingInvite = await this.prisma.tournamentInvitation.findFirst({
      where: {
        tournamentId: dto.tournamentId,
        teamId: dto.teamId,
        status: 'PENDING',
      },
    });
    if (existingInvite)
      throw new BadRequestException('Запрошення вже надіслано');

    // 4. Створюємо інвайт
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

    // 4. Відправляємо листа з посиланням для прийняття запрошення
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

      // --- ПРАВИЛО 3: Розумна маршрутизація по стадіях ---
      // Якщо команда такого ж тіру (або сильніша), вона йде в Групу.
      // Якщо команда на 1 тір слабша, вона йде в Закриті Кваліфікації (CQ).
      let assignedStage = 'CQ';
      if (invite.team.tier <= invite.tournament.tier) {
        assignedStage = 'GROUP';
      }

      // 3. Створюємо учасника
      const participantCount = await prisma.tournamentParticipant.count({
        where: { tournamentId: invite.tournamentId },
      });

      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: invite.tournamentId,
          teamId: invite.teamId,
          joinedStage: assignedStage as any, // TypeScript підказка
          seed: participantCount + 1,
        },
      });

      // 4. Фіксуємо склад
      const rosterData = rosterPlayerIds.map((playerId) => ({
        participantId: participant.id,
        playerId: playerId,
        role: 'PLAYER' as const,
      }));
      await prisma.tournamentRoster.createMany({ data: rosterData });

      // 5. Оновлюємо статус
      await prisma.tournamentInvitation.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });

      return participant;
    });
  }

  // ... методи decline та findAllByTournament залишаються без змін
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

  findAllByTournament(tournamentId: string) {
    return this.prisma.tournamentInvitation.findMany({
      where: { tournamentId },
      include: { team: { select: { name: true, tag: true } } },
    });
  }
}
