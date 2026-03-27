import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async create(createGameDto: CreateGameDto) {
    const existingGame = await this.prisma.game.findUnique({
      where: { slug: createGameDto.slug },
    });

    if (existingGame) {
      throw new ConflictException('Гра з таким slug вже існує');
    }

    return this.prisma.game.create({
      data: createGameDto,
    });
  }

  findAll() {
    return this.prisma.game.findMany({
      include: {
        _count: {
          select: { tournaments: true, players: true }, // Одразу показуємо статистику дисципліни
        },
      },
    });
  }

  async findOne(id: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) throw new NotFoundException('Гру не знайдено');
    return game;
  }

  async update(id: string, updateGameDto: UpdateGameDto) {
    if (updateGameDto.slug) {
      const existingGame = await this.prisma.game.findFirst({
        where: { slug: updateGameDto.slug, NOT: { id } },
      });
      if (existingGame)
        throw new ConflictException('Гра з таким slug вже існує');
    }

    return this.prisma.game.update({
      where: { id },
      data: updateGameDto,
    });
  }

  async remove(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: { _count: { select: { players: true, tournaments: true } } },
    });

    if (!game) throw new NotFoundException('Гру не знайдено');

    // Захист цілісності бази даних
    if (game._count.players > 0 || game._count.tournaments > 0) {
      throw new BadRequestException(
        `Неможливо видалити гру. До неї прив'язано гравців: ${game._count.players}, турнірів: ${game._count.tournaments}`,
      );
    }

    return this.prisma.game.delete({ where: { id } });
  }
}
