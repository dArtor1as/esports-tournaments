import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RosterRole } from '@prisma/client';
import { AccessPolicyService } from '../auth/access-policy.service';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { TierHelper } from 'common/helpers/tier.helper';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // метод для перерахунку прапора
  async recalculateTeamCountry(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { players: { include: { user: true } } }, // Витягуємо гравців та їхніх юзерів
    });

    if (!team || team.isManualCountry) return; // Якщо ручне налаштування, ігноруємо

    const activePlayers = team.players.filter(
      (p) => p.teamRole === 'PLAYER' || p.teamRole === 'CAPTAIN',
    );
    if (activePlayers.length === 0) return;

    // Рахуємо кількість кожного countryCode
    const countryCounts: Record<string, number> = {};
    for (const player of activePlayers) {
      const code = player.user?.countryCode;
      if (code) {
        countryCounts[code] = (countryCounts[code] || 0) + 1;
      }
    }

    let majorityCountry = 'INT';
    // строго більше половини
    const threshold = Math.floor(activePlayers.length / 2) + 1;

    for (const [code, count] of Object.entries(countryCounts)) {
      if (count >= threshold) {
        majorityCountry = code;
        break;
      }
    }

    // Оновлюємо БД в разі зміни прапора
    if (team.countryCode !== majorityCountry) {
      await this.prisma.team.update({
        where: { id: teamId },
        data: { countryCode: majorityCountry },
      });
    }
  }

  async create(createTeamDto: CreateTeamDto, userId: string) {
    // Шукаємо за конкретним ID, який передали в DTO
    const captain = await this.prisma.player.findFirst({
      where: { id: createTeamDto.captainPlayerId },
      include: { game: true },
    });

    if (!captain) throw new BadRequestException('Ігровий профіль не знайдено');

    // БЕЗПЕКА: Перевіряємо, чи юзер не намагається зробити капітаном когось іншого
    if (captain.userId !== userId) {
      throw new BadRequestException(
        'Ви не можете створити команду від імені іншого профілю',
      );
    }
    if (captain.teamId) {
      throw new BadRequestException(
        'Цей ігровий профіль вже перебуває в іншій команді',
      );
    }

    const existingTeam = await this.prisma.team.findFirst({
      where: {
        gameId: captain.gameId,
        OR: [{ name: createTeamDto.name }, { tag: createTeamDto.tag }],
      },
    });
    if (existingTeam)
      throw new ConflictException('Команда з такою назвою або тегом вже існує');

    return this.prisma.$transaction(async (prisma) => {
      // Створюємо команду і записуємо капітана
      const newTeam = await prisma.team.create({
        data: {
          name: createTeamDto.name,
          tag: createTeamDto.tag,
          gameId: captain.gameId,
          region: createTeamDto.region || 'GLOBAL',
          captainId: captain.id,
          // беремо рейтинг капітана як початковий середній рейтинг команди
          averageRating: captain.rating,
          tier: TierHelper.calculateTier(captain.rating),
          isComplete: captain.game.minTeamSize === 1,
        },
      });

      // Прив'язуємо цього гравця до команди як звичайного учасника
      await prisma.player.update({
        where: { id: captain.id },
        data: { teamId: newTeam.id, teamRole: 'CAPTAIN' },
      });

      await this.cacheManager.del('all_teams'); // Очищаємо кеш при створенні нової команди

      return newTeam;
    });
  }

  findAll() {
    return this.prisma.team.findMany({
      include: {
        players: { select: { id: true, nickname: true } }, // Одразу показуємо склад команди
        game: { select: { name: true, slug: true } },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        game: true,
        captain: { include: { user: true } },
        players: {
          select: {
            id: true,
            nickname: true,
            inGameRole: true,
            rating: true,
            teamRole: true,
            user: {
              select: {
                countryCode: true,
                username: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, updateTeamDto: UpdateTeamDto, user: JwtPayload) {
    // 1. Шукаємо команду разом із капітаном
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { captain: true }, // Тягнемо капітана
    });

    if (!team) throw new NotFoundException('Команду не знайдено');

    // перевіряємо, чи юзер є капітаном або адміном
    this.accessPolicy.checkCaptainOrAdmin(team.captain.userId, user);
    // Якщо хочуть змінити назву або тег, перевіряємо, чи вони вільні
    if (updateTeamDto.name || updateTeamDto.tag) {
      const existingTeam = await this.prisma.team.findFirst({
        where: {
          gameId: team.gameId,
          OR: [{ name: updateTeamDto.name }, { tag: updateTeamDto.tag }],
          NOT: { id }, // Не перевіряємо саму себе
        },
      });

      if (existingTeam) {
        throw new ConflictException(
          'Команда з такою назвою або тегом вже існує',
        );
      }
    }

    const updatedTeam = await this.prisma.team.update({
      where: { id },
      data: {
        name: updateTeamDto.name,
        tag: updateTeamDto.tag,
      },
    });

    await this.cacheManager.del('all_teams'); // Очищаємо кеш при оновленні команди

    return updatedTeam;
  }

  async updatePlayerTeamRole(
    teamId: string,
    playerId: string,
    newRole: RosterRole,
    user: JwtPayload,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { captain: true },
    });

    if (!team) throw new NotFoundException('Команду не знайдено');

    // Перевіряємо, чи має користувач права капітана або адміна
    this.accessPolicy.checkCaptainOrAdmin(team.captain.userId, user);

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player || player.teamId !== teamId) {
      throw new BadRequestException('Гравець не перебуває у цій команді');
    }

    // Захист від зміни ролі діючого капітана
    if (team.captainId === playerId) {
      throw new BadRequestException(
        'Не можна змінити роль капітана таким чином. Використовуйте передачу лідерства.',
      );
    }

    // Оновлюємо роль
    await this.prisma.player.update({
      where: { id: playerId },
      data: { teamRole: newRole },
    });

    //очищаємо кеш, оскільки змінився склад команди
    await this.cacheManager.del('all_teams');
    await this.cacheManager.del('all_players');

    return { message: 'Роль гравця успішно оновлена', newRole };
  }

  async remove(id: string, user: JwtPayload) {
    const teamCheck = await this.prisma.team.findUnique({
      where: { id },
      include: { captain: true },
    });

    if (!teamCheck) throw new NotFoundException('Команду не знайдено');
    this.accessPolicy.checkCaptainOrAdmin(teamCheck.captain.userId, user);
    // Використовуємо транзакцію для безпечного дісбанду
    const disbandedTeam = await this.prisma.$transaction(async (prisma) => {
      // 1. Змінюємо статус команди на DISBANDED
      const team = await prisma.team.update({
        where: { id },
        data: { status: 'DISBANDED' },
      });

      const teamPlayers = await prisma.player.findMany({
        where: { teamId: id },
      });

      // 2. Виключаємо всіх гравців із цієї команди (робимо їх вільними агентами)
      await prisma.player.updateMany({
        where: { teamId: id },
        data: { teamId: null, teamRole: null },
      });

      // логуємо LEAVE для кожного гравця, який був у команді
      if (teamPlayers.length > 0) {
        await prisma.teamTransfer.createMany({
          data: teamPlayers.map((p) => ({
            playerId: p.id,
            teamId: id,
            type: 'LEAVE',
          })),
        });
      }

      return team;
    });

    await this.cacheManager.del('all_teams'); // Очищаємо кеш при видаленні команди

    return disbandedTeam;
  }
}
