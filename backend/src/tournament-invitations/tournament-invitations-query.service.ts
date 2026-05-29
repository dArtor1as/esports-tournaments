import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class TournamentInvitationsQueryService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
  ) {}

  async findMyTeamInvites(userId: string) {
    return this.prisma.tournamentInvitation.findMany({
      where: {
        status: 'PENDING',
        team: {
          captain: { userId }, // Тільки ті команди, де юзер — капітан
        },
        expiresAt: { gt: new Date() },
      },
      include: {
        tournament: { select: { title: true, region: true, tier: true } },
        team: { select: { name: true, tag: true } },
      },
    });
  }

  async findAllByTournament(tournamentId: string, user: JwtPayload) {
    // 1. Шукаємо турнір, щоб дізнатися, хто його створив
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { creatorId: true },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    // 2. Перевіряємо, чи це творець турніру або Адмін
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    // 3. Віддаємо інвайти
    return this.prisma.tournamentInvitation.findMany({
      where: { tournamentId },
      include: { team: { select: { name: true, tag: true } } },
    });
  }
}
