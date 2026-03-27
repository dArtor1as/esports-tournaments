import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  private calculateTier(rating: number): number {
    if (rating >= 2500) return 1;
    if (rating >= 1500) return 2;
    return 3;
  }

  async create(createTeamDto: CreateTeamDto) {
    const captain = await this.prisma.player.findUnique({
      where: { id: createTeamDto.captainPlayerId },
    });

    if (!captain) throw new BadRequestException('Гравець не знайдений');
    if (captain.teamId)
      throw new BadRequestException('Ви вже перебуваєте в команді');

    const existingTeam = await this.prisma.team.findFirst({
      where: { OR: [{ name: createTeamDto.name }, { tag: createTeamDto.tag }] },
    });
    if (existingTeam)
      throw new ConflictException('Команда з такою назвою або тегом вже існує');

    return this.prisma.$transaction(async (prisma) => {
      // Створюємо команду і записуємо капітана
      const newTeam = await prisma.team.create({
        data: {
          name: createTeamDto.name,
          tag: createTeamDto.tag,
          region: createTeamDto.region || 'GLOBAL',
          captainId: captain.id,
          // беремо рейтинг капітана як початковий середній рейтинг команди
          averageRating: captain.rating,
          tier: this.calculateTier(captain.rating),
        },
      });

      // Прив'язуємо цього гравця до команди як звичайного учасника (щоб він був у списку гравців)
      await prisma.player.update({
        where: { id: captain.id },
        data: { teamId: newTeam.id },
      });

      return newTeam;
    });
  }

  findAll() {
    return this.prisma.team.findMany({
      include: {
        players: { select: { id: true, nickname: true } }, // Одразу показуємо склад команди
      },
    });
  }

  findOne(id: string) {
    return this.prisma.team.findUnique({
      where: { id },
      include: { players: true },
    });
  }

  async update(id: string, updateTeamDto: UpdateTeamDto) {
    // Якщо хочуть змінити назву або тег, перевіряємо, чи вони вільні
    if (updateTeamDto.name || updateTeamDto.tag) {
      const existingTeam = await this.prisma.team.findFirst({
        where: {
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

    return this.prisma.team.update({
      where: { id },
      data: {
        name: updateTeamDto.name,
        tag: updateTeamDto.tag,
        // captainPlayerId тут не оновлюємо, передача капітанства - це окрема складна логіка
      },
    });
  }

  async remove(id: string) {
    // Використовуємо транзакцію для безпечного дісбанду
    return this.prisma.$transaction(async (prisma) => {
      // 1. Змінюємо статус команди на DISBANDED
      const disbandedTeam = await prisma.team.update({
        where: { id },
        data: { status: 'DISBANDED' },
      });

      // 2. Виключаємо всіх гравців із цієї команди (робимо їх вільними агентами)
      await prisma.player.updateMany({
        where: { teamId: id },
        data: { teamId: null },
      });

      return disbandedTeam;
    });
  }
}
