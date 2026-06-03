import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private mailService: MailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    // 1. Перевіряємо email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingEmail)
      throw new ConflictException('Email вже використовується');

    // 2. Перевіряємо username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });
    if (existingUsername) throw new ConflictException('Цей логін вже зайнятий');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        username: createUserDto.username,
        email: createUserDto.email,
        passwordHash: hashedPassword,
        role: createUserDto.role || 'USER',
        countryCode: createUserDto.countryCode?.toUpperCase(),
        birthDate: createUserDto.birthDate
          ? new Date(createUserDto.birthDate)
          : undefined,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        countryCode: true,
        birthDate: true,
      },
    });

    return newUser;
  }
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        countryCode: true,
        birthDate: true,
        players: {
          select: { id: true, gameId: true, nickname: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }
  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        countryCode: true,
        birthDate: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto, user: JwtPayload) {
    // 1. Шукаємо користувача
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('Користувача не знайдено');

    // 2. перевіряємо, чи це сам користувач або він Адмін?
    this.accessPolicy.checkSelfOrAdmin(targetUser.id, user);

    // 3. Якщо перевірка пройдена - оновлюємо
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async requestDeletionCode(id: string, currentUser: JwtPayload) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('Користувача не знайдено');
    this.accessPolicy.checkSelfOrAdmin(targetUser.id, currentUser);

    // Генеруємо 6-значний код
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Зберігаємо в кеш на 15 хвилин (900000 мс)
    await this.cacheManager.set(`delete_code_${id}`, code, 900000);

    // Відправляємо на пошту
    await this.mailService.sendAccountDeletionCode(targetUser.email, code);

    return { message: 'Код відправлено на пошту' };
  }

  async remove(id: string, currentUser: JwtPayload, code?: string) {
    const savedCode = await this.cacheManager.get(`delete_code_${id}`);
    if (!savedCode || savedCode !== code) {
      throw new BadRequestException(
        'Недійсний або прострочений код підтвердження',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      include: { players: true }, // Підтягуємо всі ігрові профілі
    });

    if (!targetUser) throw new NotFoundException('Користувача не знайдено');
    if (targetUser.deletedAt)
      throw new ConflictException('Акаунт вже видалено');

    this.accessPolicy.checkSelfOrAdmin(targetUser.id, currentUser);
    const isAdmin = currentUser.role === 'ADMIN';

    if (!isAdmin) {
      if (!code)
        throw new BadRequestException("Код підтвердження є обов'язковим");
      const savedCode = await this.cacheManager.get(`delete_code_${id}`);
      if (!savedCode || savedCode !== code) {
        throw new BadRequestException(
          'Недійсний або прострочений код підтвердження',
        );
      }
    }

    const randomHex = crypto.randomBytes(4).toString('hex');

    await this.prisma.$transaction(async (prismaTx) => {
      // 1. Анонімізуємо основний акаунт (User)
      await prismaTx.user.update({
        where: { id },
        data: {
          username: `deleted_user_${randomHex}`,
          email: `deleted_${randomHex}@anonymized.local`,
          passwordHash: 'DELETED',
          birthDate: null,
          countryCode: null,
          deletedAt: new Date(),
        },
      });

      // 2. Обробляємо кожен ігровий профіль юзера
      for (const player of targetUser.players) {
        // Якщо гравець був у команді, обробляємо логіку команди
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
                // Віддаємо капітанство першому ліпшому гравцеві
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
                // Якщо був останній у команді - розпускаємо
                await prismaTx.team.update({
                  where: { id: team.id },
                  data: { status: 'DISBANDED' }, // Припускаємо, що у тебе є статус DISBANDED
                });
              }
            }
          }
        }

        // Анонімізуємо сам ігровий профіль (Player) і відв'язуємо від команди
        const playerRandom = crypto.randomBytes(2).toString('hex');
        await prismaTx.player.update({
          where: { id: player.id },
          data: {
            nickname: `Anonymous_${playerRandom}`,
            teamId: null,
            teamRole: null,
            deletedAt: new Date(),
          },
        });
      }
    });

    if (!isAdmin) {
      await this.cacheManager.del(`delete_code_${id}`);
    }

    return { message: 'Акаунт успішно анонімізовано' };
  }
}
