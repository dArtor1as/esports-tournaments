import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { AccessPolicyService } from 'src/auth/access-policy.service';
@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createTournamentDto: CreateTournamentDto, userId: string) {
    // Перевіряємо, чи існує така гра в базі
    const game = await this.prisma.game.findUnique({
      where: { id: createTournamentDto.gameId },
    });

    if (!game) {
      throw new NotFoundException('Дисципліна (гра) не знайдена');
    }

    let kFactor = 1.0; // за замовчуванням для Tier 1
    if (createTournamentDto.tier === 2) kFactor = 0.6;
    if (createTournamentDto.tier === 3) kFactor = 0.3;

    // Створюємо турнір. Статус 'planned' ставиться автоматично завдяки @default в схемі
    const createdTournament = await this.prisma.tournament.create({
      data: {
        title: createTournamentDto.title,
        gameId: createTournamentDto.gameId,
        tier: createTournamentDto.tier,
        region: createTournamentDto.region,
        kFactor: kFactor,
        format: createTournamentDto.format || 'TEAM',
        maxParticipants: createTournamentDto.maxParticipants || 16,
        settings: createTournamentDto.settings
          ? (createTournamentDto.settings as Prisma.InputJsonValue)
          : Prisma.JsonNull, // JSON-поля
        creatorId: userId,
        isPublic: createTournamentDto.isPublic,
      },
    });

    return createdTournament;
  }

  async update(
    id: string,
    updateTournamentDto: UpdateTournamentDto,
    user: JwtPayload,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    // Захист: якщо турнір вже йде або завершився, забороняємо міняти ключові формати
    if (
      tournament.status !== 'planned' &&
      (updateTournamentDto.format || updateTournamentDto.gameId)
    ) {
      throw new BadRequestException(
        'Неможливо змінити формат або гру після старту турніру',
      );
    }

    const updatedTournament = await this.prisma.tournament.update({
      where: { id },
      data: updateTournamentDto as unknown as Prisma.TournamentUpdateInput,
    });

    return updatedTournament;
  }

  //  Скасування LIVE турніру
  async cancelTournament(id: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    if (tournament.status === 'finished' || tournament.status === 'cancelled') {
      throw new BadRequestException('Турнір вже завершено або скасовано');
    }

    await this.prisma.$transaction(async (prismaTx) => {
      // 1. Анулюємо всі матчі, які ще не були зіграні
      await prismaTx.match.updateMany({
        where: {
          tournamentId: id,
          isProcessed: false,
          matchStatus: { not: 'COMPLETED' },
        },
        data: {
          scoreA: 0,
          scoreB: 0,
          isProcessed: true,
          matchStatus: 'CANCELLED', // Позначаємо їх як скасовані
          stats: Prisma.JsonNull,
          details: Prisma.JsonNull,
        },
      });

      // 2. Ставимо турніру статус "cancelled"
      await prismaTx.tournament.update({
        where: { id },
        data: { status: 'cancelled' },
      });
    });

    return {
      message: 'Турнір скасовано. Всі незіграні матчі анульовано без змін Elo.',
    };
  }

  async remove(id: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: { matches: true },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    // Безпечне видалення: дозволяємо видаляти тільки якщо немає згенерованих матчів
    if (tournament.matches.length > 0) {
      throw new BadRequestException(
        'Неможливо видалити турнір, в якому вже є матчі. Змініть статус на cancelled.',
      );
    }

    const deletedTournament = await this.prisma.tournament.delete({
      where: { id },
    });

    return deletedTournament;
  }
}
