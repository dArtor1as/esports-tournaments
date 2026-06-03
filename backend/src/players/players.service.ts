import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GameSlug } from './player.enums';
import { assertRoleAllowedForGame } from './players-role.policy';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import * as crypto from 'crypto';

@Injectable()
export class PlayersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private accessPolicy: AccessPolicyService,
  ) {}

  async create(createPlayerDto: CreatePlayerDto, userId: string) {
    //  Перевіряємо тільки АКТИВНІ профілі
    const existingProfile = await this.prisma.player.findFirst({
      where: {
        userId,
        game: { slug: createPlayerDto.gameSlug },
        deletedAt: null, // Дозволяє створити новий профіль, якщо старий видалено
      },
    });

    if (existingProfile) {
      throw new ConflictException(
        'У вас вже є активний профіль у цій дисципліні',
      );
    }

    //  ЛОГІКА ГЕНЕРАЦІЇ РЕЙТИНГУ
    let initialRating = 1000;

    if (createPlayerDto.expectedTier) {
      switch (createPlayerDto.expectedTier) {
        case 1:
          // Tier 1: рейтинг >= 2700. Генеруємо від 2700 до 3000
          initialRating = Math.floor(Math.random() * (3000 - 2700 + 1)) + 2700;
          break;
        case 2:
          // Tier 2: рейтинг від 1800 до 2699.
          initialRating = Math.floor(Math.random() * (2699 - 1800 + 1)) + 1800;
          break;
        case 3:
          // Tier 3: рейтинг до 1799. Генеруємо від 800 до 1799
          initialRating = Math.floor(Math.random() * (1799 - 800 + 1)) + 800;
          break;
      }
    }

    const newPlayer = await this.prisma.player.create({
      data: {
        user: { connect: { id: userId } },
        game: { connect: { slug: createPlayerDto.gameSlug } },
        nickname: createPlayerDto.nickname,
        rating: initialRating,
        inGameRole: createPlayerDto.inGameRole,
        teamRole: null,
      },
    });

    await this.cacheManager.del('all_players');
    return newPlayer;
  }

  findAll(userId?: string) {
    //  Не показуємо анонімізовані профілі у загальних списках
    return this.prisma.player.findMany({
      where: {
        deletedAt: null,
        ...(userId ? { userId } : {}),
      },
      include: {
        game: { select: { name: true, slug: true } },
        user: { select: { username: true } },
        team: { select: { id: true, name: true, tag: true } },
      },
    });
  }

  async findMyProfiles(userId: string) {
    // Юзер бачить тільки свої активні профілі
    return this.prisma.player.findMany({
      where: { userId, deletedAt: null },
      include: {
        game: { select: { name: true, slug: true } },
        team: { select: { id: true, name: true, tag: true } },
      },
    });
  }

  findOne(id: string) {
    // Тут фільтр не ставимо, щоб історія турнірів (де є ID гравця) могла відмалювати його картку
    return this.prisma.player.findUnique({
      where: { id },
      include: {
        team: true,
        user: {
          select: { countryCode: true, birthDate: true, username: true },
        },
        game: true,
      },
    });
  }

  async update(id: string, updatePlayerDto: UpdatePlayerDto, user: JwtPayload) {
    // 1. Шукаємо профіль разом із грою (нам потрібен slug гри для валідації ролі)
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: { game: true },
    });

    //  Якщо профіль видалений — редагувати його не можна
    if (!player || player.deletedAt) {
      throw new NotFoundException(
        'Ігровий профіль не знайдено або він видалений',
      );
    }

    this.accessPolicy.checkSelfOrAdmin(player.userId, user);

    // 3.Якщо змінюється роль, перевіряємо її сумісність з грою профілю
    if (updatePlayerDto.inGameRole) {
      assertRoleAllowedForGame(
        player.game.slug as GameSlug,
        updatePlayerDto.inGameRole,
      );
    }

    // 4. Оновлюємо профіль
    const updatedPlayer = await this.prisma.player.update({
      where: { id },
      data: updatePlayerDto,
    });

    await this.cacheManager.del('all_players');
    return updatedPlayer;
  }

  async remove(id: string, user: JwtPayload) {
    // 1. Перевіряємо, чи існує гравець
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Ігровий профіль не знайдено');
    if (player.deletedAt) throw new ConflictException('Профіль вже видалено');

    // 2.Перевіряємо гравця на належність до юзера, який робить запит
    this.accessPolicy.checkSelfOrAdmin(player.userId, user);

    const randomHex = crypto.randomBytes(2).toString('hex');

    await this.prisma.$transaction(async (prismaTx) => {
      if (player.teamId) {
        const team = await prismaTx.team.findUnique({
          where: { id: player.teamId },
          include: { players: { where: { deletedAt: null } } },
        });

        if (team) {
          const isCaptain = team.captainId === player.id;
          const otherPlayers = team.players.filter((p) => p.id !== player.id);

          if (isCaptain) {
            if (otherPlayers.length > 0) {
              const newCaptain = otherPlayers[0];
              await prismaTx.team.update({
                where: { id: team.id },
                data: { captainId: newCaptain.id },
              });
              await prismaTx.player.update({
                where: { id: newCaptain.id },
                data: { teamRole: 'CAPTAIN' },
              });
            } else {
              await prismaTx.team.update({
                where: { id: team.id },
                data: { status: 'DISBANDED' },
              });
            }
          }
        }
      }

      await prismaTx.player.update({
        where: { id },
        data: {
          nickname: `Anonymous_${randomHex}`,
          teamId: null,
          teamRole: null,
          deletedAt: new Date(),
        },
      });
    });

    await this.cacheManager.del('all_players');
    return { message: 'Ігровий профіль успішно анонімізовано' };
  }
}
