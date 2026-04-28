import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TeamInvitationsService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.teamInvitation.create({
      data: {
        teamId: createDto.teamId,
        userId: createDto.userId,
        token,
        expiresAt,
      },
    });
  }

  // Метод прийняття запрошення
  async accept(token: string, playerId: string) {
    return this.prisma.$transaction(async (prisma) => {
      // 1. Перевірки інвайту та гравця
      const invite = await prisma.teamInvitation.findUnique({
        where: { token },
      });
      if (!invite) throw new NotFoundException('Запрошення не знайдено');
      if (invite.status !== 'PENDING')
        throw new BadRequestException('Запрошення вже оброблено');
      if (invite.expiresAt < new Date())
        throw new BadRequestException('Термін дії запрошення минув');

      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });
      if (!player) throw new NotFoundException('Ігровий профіль не знайдено');
      if (player.userId !== invite.userId)
        throw new BadRequestException(
          'Цей профіль належить іншому користувачу',
        );
      if (player.teamId)
        throw new BadRequestException('Ви вже перебуваєте в команді');

      // 2. Додаємо гравця в команду
      await prisma.player.update({
        where: { id: playerId },
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
      let newTier = 3;
      if (newAverageRating >= 2500) newTier = 1;
      else if (newAverageRating >= 1800) newTier = 2;

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
  async decline(token: string) {
    const invite = await this.prisma.teamInvitation.findUnique({
      where: { token },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new BadRequestException('Запрошення недійсне або вже оброблено');
    }

    return this.prisma.teamInvitation.update({
      where: { id: invite.id },
      data: { status: 'DECLINED' },
    });
  }

  findAll() {
    return this.prisma.teamInvitation.findMany();
  }
}
