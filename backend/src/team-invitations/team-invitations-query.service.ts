import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamInvitationsQueryService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.teamInvitation.findMany();
  }

  async findMyInvites(userId: string) {
    return this.prisma.teamInvitation.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        team: { select: { name: true, tag: true, logoUrl: true } },
      },
    });
  }
}
