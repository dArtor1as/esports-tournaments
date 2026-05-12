import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import * as crypto from 'crypto';
import { TeamsService } from 'src/teams/teams.service';

@Injectable()
export class TeamInvitationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private teamsService: TeamsService,
  ) {}

  async create(createDto: CreateTeamInvitationDto) {
    // 1. Перевіряємо, чи немає вже активного інвайту для цього юзера в цю команду
    const existingInvite = await this.prisma.teamInvitation.findUnique({
      where: {
        teamId_userId: { teamId: createDto.teamId, userId: createDto.userId },
      },
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      throw new BadRequestException(
        'Запрошення вже надіслано і очікує відповіді',
      );
    }

    // 2. Генеруємо унікальний токен (32 символи)
    const token = crypto.randomBytes(16).toString('hex');

    // 3. Ставимо термін дії (наприклад, 7 днів від сьогодні)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.prisma.teamInvitation.create({
      data: {
        teamId: createDto.teamId,
        userId: createDto.userId,
        token,
        expiresAt,
      },
      include: { team: true, user: true },
    });
    // 4. Відправляємо листа з посиланням для прийняття запрошення
    await this.mailService.sendTeamInvite(
      invite.user.email,
      invite.team.name,
      token,
    );

    return {
      message: 'Запрошення успішно надіслано на пошту',
      inviteId: invite.id,
    };
  }

  // Метод прийняття запрошення
  async accept(token: string, playerId: string, userId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const invite = await prisma.teamInvitation.findUnique({
        where: { token },
      });

      if (!invite) throw new NotFoundException('Запрошення не знайдено');
      if (invite.status !== 'PENDING')
        throw new BadRequestException('Запрошення вже оброблено');
      if (invite.expiresAt < new Date())
        throw new BadRequestException('Термін дії запрошення минув');

      // Перевірка: чи це запрошення взагалі для цього юзера?
      if (invite.userId !== userId) {
        throw new BadRequestException(
          'Це запрошення адресоване іншому користувачу',
        );
      }

      // Шукаємо конкретнйи профіль, який передав фронтенд
      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (!player) throw new NotFoundException('Ігровий профіль не знайдено');

      // Перевірка: чи намагається юзер зайти чужим профілем?
      if (player.userId !== userId) {
        throw new BadRequestException('Цей ігровий профіль вам не належить');
      }
      if (player.teamId)
        throw new BadRequestException('Цей ігровий профіль вже в команді');

      // 2. Додаємо гравця в команду
      await prisma.player.update({
        where: { id: player.id },
        data: { teamId: invite.teamId },
      });

      // 3. Перераховуємо середній рейтинг і тір команди після додавання нового гравця
      const teamPlayers = await prisma.player.findMany({
        where: { teamId: invite.teamId },
        select: { rating: true },
      });

      // Рахуємо суму і ділимо на кількість
      const totalRating = teamPlayers.reduce((sum, p) => sum + p.rating, 0);
      const newAverageRating = Math.floor(totalRating / teamPlayers.length);

      // Визначаємо новий тір
      const newTier = this.teamsService.calculateTier(newAverageRating);

      // Оновлюємо команду
      await prisma.team.update({
        where: { id: invite.teamId },
        data: {
          averageRating: newAverageRating,
          tier: newTier,
        },
      });

      // 4. Змінюємо статус інвайту на ACCEPTED
      return prisma.teamInvitation.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
    });
  }

  // Метод відхилення запрошення
  async decline(token: string, userId: string) {
    const invite = await this.prisma.teamInvitation.findUnique({
      where: { token },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new BadRequestException('Запрошення недійсне або вже оброблено');
    }
    if (invite.userId !== userId) {
      throw new BadRequestException(
        'Це запрошення адресоване іншому користувачу',
      );
    }

    return this.prisma.teamInvitation.update({
      where: { id: invite.id },
      data: { status: 'DECLINED' },
    });
  }

  findAll() {
    return this.prisma.teamInvitation.findMany();
  }

  async findMyInvites(userId: string) {
    return this.prisma.teamInvitation.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() }, // Тільки актуальні
      },
      include: {
        team: { select: { name: true, tag: true, logoUrl: true } },
      },
    });
  }
}
