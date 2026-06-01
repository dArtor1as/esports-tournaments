import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy, mock, MockProxy } from 'jest-mock-extended';
import { TournamentInvitationsQueryService } from './tournament-invitations-query.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TournamentInvitationsQueryService', () => {
  let service: TournamentInvitationsQueryService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;

  const user: JwtPayload = { userId: 'u1', email: 't@t.com', role: Role.USER };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mock<AccessPolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentInvitationsQueryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    service = module.get<TournamentInvitationsQueryService>(
      TournamentInvitationsQueryService,
    );
  });

  it('findMyTeamInvites returns pending invites for user teams', async () => {
    prisma.tournamentInvitation.findMany.mockResolvedValueOnce([
      { id: 'inv1' },
    ] as never);
    const result = await service.findMyTeamInvites('u1');
    expect(result).toEqual([{ id: 'inv1' }]);
    expect(
      prisma.tournamentInvitation.findMany.mock.calls[0][0]?.where?.team,
    ).toMatchObject({
      captain: { userId: 'u1' },
    });
  });

  describe('findAllByTournament', () => {
    it('throws if tournament is not found', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(null);
      await expect(service.findAllByTournament('t1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns invites if authorized', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        creatorId: 'admin',
      } as never);
      prisma.tournamentInvitation.findMany.mockResolvedValueOnce([
        { id: 'inv1' },
      ] as never);

      const result = await service.findAllByTournament('t1', user);

      // ВИПРАВЛЕНО: використання mock.calls для уникнення unbound-method
      expect(accessPolicy.checkTournamentCreatorOrAdmin.mock.calls[0]).toEqual([
        'admin',
        user,
      ]);
      expect(result).toEqual([{ id: 'inv1' }]);
    });
  });
});
