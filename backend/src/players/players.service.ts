import { ConflictException, Injectable } from '@nestjs/common';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async create(createPlayerDto: CreatePlayerDto, userId: string) {
    const existingProfile = await this.prisma.player.findUnique({
      where: {
        userId_gameId: {
          userId,
          gameId: createPlayerDto.gameId,
        },
      },
    });

    if (existingProfile) {
      throw new ConflictException('У вас вже є профіль у цій дисципліні');
    }

    // --- ЛОГІКА ГЕНЕРАЦІЇ РЕЙТИНГУ ---
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

    return this.prisma.player.create({
      data: {
        userId,
        gameId: createPlayerDto.gameId,
        nickname: createPlayerDto.nickname,
        rating: initialRating, // Використовуємо згенерований рейтинг
      },
    });
  }

  findAll() {
    // Завдяки зв'язкам, ми можемо одразу витягнути дані гри та юзера
    return this.prisma.player.findMany({
      include: {
        game: { select: { name: true } },
        user: { select: { username: true } },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.player.findUnique({
      where: { id },
      include: { team: true },
    });
  }

  async update(id: string, updatePlayerDto: UpdatePlayerDto) {
    return this.prisma.player.update({
      where: { id },
      data: updatePlayerDto,
    });
  }

  async remove(id: string) {
    return this.prisma.player.delete({
      where: { id },
    });
  }
}
