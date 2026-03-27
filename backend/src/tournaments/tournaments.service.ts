import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async create(createTournamentDto: CreateTournamentDto) {
    // Перевіряємо, чи існує така гра в базі
    const game = await this.prisma.game.findUnique({
      where: { id: createTournamentDto.gameId },
    });

    if (!game) {
      throw new NotFoundException('Дисципліна (гра) не знайдена');
    }

    // Створюємо турнір. Статус 'planned' ставиться автоматично завдяки @default в схемі
    return this.prisma.tournament.create({
      data: {
        title: createTournamentDto.title,
        gameId: createTournamentDto.gameId,
        tier: createTournamentDto.tier,
        region: createTournamentDto.region,
        kFactor: createTournamentDto.kFactor,
        format: createTournamentDto.format || 'TEAM',
        maxParticipants: createTournamentDto.maxParticipants || 16,
        settings: createTournamentDto.settings, // Prisma чудово "їсть" JS-об'єкти для JSON-полів
      },
    });
  }

  findAll() {
    return this.prisma.tournament.findMany({
      include: {
        game: { select: { name: true } },
        _count: { select: { participants: true } }, // Крута фіча Prisma: одразу рахуємо кількість учасників
      },
      orderBy: { id: 'desc' }, // Спочатку нові
    });
  }

  findOne(id: string) {
    return this.prisma.tournament.findUnique({
      where: { id },
      include: {
        game: true,
        participants: {
          include: { team: true }, // Показуємо, які команди вже зареєстровані
        },
      },
    });
  }

  async update(id: string, updateTournamentDto: UpdateTournamentDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    // Захист: якщо турнір вже йде або завершився, забороняємо міняти ключові формати
    if (
      tournament.status !== 'planned' &&
      (updateTournamentDto.format || updateTournamentDto.gameId)
    ) {
      throw new BadRequestException(
        'Неможливо змінити формат або гру після старту турніру',
      );
    }

    return this.prisma.tournament.update({
      where: { id },
      data: updateTournamentDto,
    });
  }

  async remove(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: { matches: true },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    // Безпечне видалення: дозволяємо видаляти тільки якщо немає згенерованих матчів
    if (tournament.matches.length > 0) {
      throw new BadRequestException(
        'Неможливо видалити турнір, в якому вже є матчі. Змініть статус на cancelled.',
      );
    }

    // Якщо матчів немає, можемо фізично видалити
    return this.prisma.tournament.delete({
      where: { id },
    });
  }
}
