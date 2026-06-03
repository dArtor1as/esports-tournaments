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

@Injectable()
export class PlayersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private accessPolicy: AccessPolicyService,
  ) {}

  async create(createPlayerDto: CreatePlayerDto, userId: string) {
    const existingProfile = await this.prisma.player.findFirst({
      where: {
        userId,
        game: { slug: createPlayerDto.gameSlug },
      },
    });

    if (existingProfile) {
      throw new ConflictException('У вас вже є профіль у цій дисципліні');
    }

    //  ЛОГІКА ГЕНЕРАЦІЇ РЕЙТИНГУ
    let initialRating = 1000;

    if (createPlayerDto.expectedTier) {
      switch (createPlayerDto.expectedTier) {
        case 1:
          initialRating = Math.floor(Math.random() * (3200 - 2500 + 1)) + 2500;
          break;
        case 2:
          initialRating = Math.floor(Math.random() * (2499 - 1500 + 1)) + 1500;
          break;
        case 3:
          initialRating = Math.floor(Math.random() * (1499 - 800 + 1)) + 800;
          break;
      }
    }

    const newPlayer = await this.prisma.player.create({
      data: {
        user: { connect: { id: userId } },
        game: { connect: { slug: createPlayerDto.gameSlug } },
        nickname: createPlayerDto.nickname,
        rating: initialRating, // Використовуємо згенерований рейтинг
        inGameRole: createPlayerDto.inGameRole,
        teamRole: null,
      },
    });

    await this.cacheManager.del('all_players'); // Очищаємо кеш при створенні нового гравця

    return newPlayer;
  }

  findAll(userId?: string) {
    // Завдяки зв'язкам, ми можемо одразу витягнути дані гри та юзера
    return this.prisma.player.findMany({
      where: userId ? { userId } : undefined,
      include: {
        game: { select: { name: true } },
        user: { select: { username: true } },
        team: { select: { id: true, name: true, tag: true } },
      },
    });
  }

  async findMyProfiles(userId: string) {
    return this.prisma.player.findMany({
      where: { userId },
      include: {
        game: { select: { name: true, slug: true } },
        team: { select: { id: true, name: true, tag: true } },
      },
    });
  }

  findOne(id: string) {
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
    if (!player) throw new NotFoundException('Ігровий профіль не знайдено');

    // 2.Перевіряємо, чи не намагається юзер змінити чужий профіль?
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

    await this.cacheManager.del('all_players'); // Очищаємо кеш при оновленні гравця

    return updatedPlayer;
  }

  async remove(id: string, user: JwtPayload) {
    // 1. Перевіряємо, чи існує гравець
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Ігровий профіль не знайдено');

    // 2.Перевіряємо гравця на належність до юзера, який робить запит
    this.accessPolicy.checkSelfOrAdmin(player.userId, user);

    // 3. Видаляємо
    await this.prisma.player.delete({ where: { id } });

    // 4. Очищаємо кеш
    await this.cacheManager.del('all_players');

    return { message: 'Ігровий профіль успішно видалено' };
  }
}
