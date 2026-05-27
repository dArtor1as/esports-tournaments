import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from 'common/utils/paginate.util';
import { PaginationQueryDto } from 'common/dto/pagination-query.dto';
import { TournamentQueryDto } from './dto/tournament-query.dto';
import { Prisma } from 'node_modules/@prisma/client/default';

@Injectable()
export class TournamentsQueryService {
  constructor(private prisma: PrismaService) {}

  // 1. Гнучкий пошук та фільтрація
  async findAll(query: TournamentQueryDto) {
    const where: Prisma.TournamentWhereInput = {
      ...(query.gameSlug && { game: { slug: query.gameSlug } }),
      ...(query.region && { region: query.region }),
      ...(query.status && { status: query.status }),
      ...(query.tier && { tier: query.tier }),
      ...(query.isPublic !== undefined && {
        isPublic: query.isPublic === 'true',
      }),
    };
    // Пошук за назвою (частковий збіг, case-insensitive)
    if (query.title) {
      where.title = {
        contains: query.title,
        mode: 'insensitive',
      };
    }

    return paginate(this.prisma.tournament, where, query, {
      game: { select: { name: true, slug: true } },
      _count: { select: { participants: true } },
    });
  }

  // 2. Мої турніри (як Організатора)
  async findMyTournaments(userId: string, query: PaginationQueryDto) {
    return paginate(this.prisma.tournament, { creatorId: userId }, query, {
      game: { select: { name: true, slug: true } },
      _count: { select: { participants: true, matches: true } },
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
