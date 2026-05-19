import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class TeamTransfersService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // 1. Гравець сам покидає команду
  async leaveTeam(teamId: string, playerId: string, user: JwtPayload) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!team || !player)
      throw new NotFoundException('Команду або гравця не знайдено');

    if (player.userId !== user.userId) {
      throw new ForbiddenException(
        'Ви не можете вийти з команди за іншого гравця',
      );
    }
    if (player.teamId !== teamId) {
      throw new BadRequestException('Гравець не перебуває у цій команді');
    }

    if (team.captainId === playerId) {
      throw new BadRequestException(
        'Капітан не може покинути команду. Передайте лідерство іншому гравцю або розпустіть команду (Disband).',
      );
    }

    return this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.player.update({
        where: { id: playerId },
        data: { teamId: null, teamRole: null },
      });

      await prismaTx.teamTransfer.create({
        data: { playerId, teamId, type: 'LEAVE' },
      });
      // Робимо команду неукомплектованою, рейтинг НЕ чіпаємо (заморожуємо)
      await prismaTx.team.update({
        where: { id: teamId },
        data: { isComplete: false },
      });

      await this.cacheManager.del('all_teams');
      await this.cacheManager.del('all_players');
      return {
        message: 'Ви успішно покинули команду. Склад команди визнано неповним.',
      };
    });
  }
  // 2. Капітан передає лідерство гравцю
  async transferLeadership(
    teamId: string,
    newCaptainPlayerId: string,
    currentUser: JwtPayload,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { captain: true },
    });

    if (!team) throw new NotFoundException('Команду не знайдено');

    // 1. Перевірка: чи це робить поточний капітан або адмін
    this.accessPolicy.checkCaptainOrAdmin(team.captain.userId, currentUser);

    // 2. Перевірка: чи новий капітан взагалі є в цій команді
    const newCaptain = await this.prisma.player.findUnique({
      where: { id: newCaptainPlayerId },
    });

    if (!newCaptain || newCaptain.teamId !== teamId) {
      throw new BadRequestException(
        'Новий капітан повинен бути учасником цієї команди',
      );
    }

    if (team.captainId === newCaptainPlayerId) {
      throw new BadRequestException('Цей гравець уже є капітаном');
    }

    // 3. Зміна капітана ТА РОЛЕЙ в транзакції
    await this.prisma.$transaction(async (prismaTx) => {
      // Старому капітану повертаємо базову роль PLAYER
      await prismaTx.player.update({
        where: { id: team.captainId },
        data: { teamRole: 'PLAYER' },
      });

      // Новому капітану видаємо роль CAPTAIN
      await prismaTx.player.update({
        where: { id: newCaptainPlayerId },
        data: { teamRole: 'CAPTAIN' },
      });

      // Оновлюємо запис самої команди
      await prismaTx.team.update({
        where: { id: teamId },
        data: { captainId: newCaptainPlayerId },
      });
    });

    // Очищуємо кеш після всіх оновлень
    await this.cacheManager.del('all_teams');

    return {
      message: `Лідерство успішно передано гравцю ${newCaptain.nickname}`,
      newCaptainId: newCaptainPlayerId,
    };
  }

  // 3. Капітан кікає гравця
  async kickPlayer(teamId: string, playerId: string, user: JwtPayload) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { captain: true },
    });
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!team || !player)
      throw new NotFoundException('Команду або гравця не знайдено');
    if (player.teamId !== teamId)
      throw new BadRequestException('Гравець не в цій команді');
    if (team.captainId === playerId)
      throw new BadRequestException('Капітан не може кікнути самого себе');

    this.accessPolicy.checkCaptainOrAdmin(team.captain.userId, user);

    return this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.player.update({
        where: { id: playerId },
        data: { teamId: null, teamRole: null },
      });

      await prismaTx.teamTransfer.create({
        data: { playerId, teamId, type: 'KICK' },
      });
      // Робимо команду неукомплектованою, рейтинг заморожуємо
      await prismaTx.team.update({
        where: { id: teamId },
        data: { isComplete: false },
      });

      await this.cacheManager.del('all_teams');
      await this.cacheManager.del('all_players');
      return {
        message:
          'Гравця успішно кікнуто з команди. Склад команди визнано неповним.',
      };
    });
  }

  // 3. Історія команди
  async getTeamTransfers(teamId: string) {
    return this.prisma.teamTransfer.findMany({
      where: { teamId },
      include: { player: { select: { nickname: true, inGameRole: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 4. Історія гравця
  async getPlayerTransfers(playerId: string) {
    return this.prisma.teamTransfer.findMany({
      where: { playerId },
      include: { team: { select: { name: true, tag: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
