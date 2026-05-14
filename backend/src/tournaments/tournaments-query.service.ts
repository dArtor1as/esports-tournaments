import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentsQueryService {
  constructor(private prisma: PrismaService) {}

  // 1. Стандартний список (можна додати пагінацію в майбутньому)
  findAll() {
    return this.prisma.tournament.findMany({
      include: {
        game: { select: { name: true, slug: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  // 2. Мої турніри (як Організатора)
  async findMyTournaments(userId: string) {
    return this.prisma.tournament.findMany({
      where: { creatorId: userId },
      include: {
        game: { select: { name: true, slug: true } },
        _count: { select: { participants: true, matches: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  // 3. Деталі турніру
  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        game: true,
        participants: {
          include: { team: true },
        },
        creator: { select: { username: true } }, // Додаємо інфо про творця
      },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    return tournament;
  }
}
