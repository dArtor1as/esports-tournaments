import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Region } from '@prisma/client';

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
      orderBy: { createdAt: 'desc' },
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
      orderBy: { createdAt: 'desc' },
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
  // 4. Отримати всі публічні турніри (для головної сторінки фронтенду)
  async findPublicActiveTournaments() {
    return this.prisma.tournament.findMany({
      where: {
        isPublic: true,
        status: { in: ['planned', 'live'] }, // Тільки ті, що можна грати або реєструватися
      },
      include: {
        game: { select: { name: true, slug: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 5. Гнучкий пошук та фільтрація (за грою, регіоном, тіром)
  async searchTournaments(filters: {
    gameSlug?: string;
    region?: Region;
    tier?: number;
  }) {
    return this.prisma.tournament.findMany({
      where: {
        isPublic: true,
        status: { not: 'cancelled' },
        ...(filters.gameSlug && { game: { slug: filters.gameSlug } }),
        ...(filters.region && { region: filters.region }),
        ...(filters.tier && { tier: Number(filters.tier) }),
      },
      include: {
        game: { select: { name: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
