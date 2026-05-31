import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { MatchesQueryService } from './matches-query.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';
import { paginate } from 'common/utils/paginate.util';

jest.mock('common/utils/paginate.util', () => ({
  paginate: jest.fn(),
}));

describe('MatchesQueryService', () => {
  let service: MatchesQueryService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mock<AccessPolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesQueryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    service = module.get<MatchesQueryService>(MatchesQueryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when match not found', async () => {
    prisma.match.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne('m1')).rejects.toThrow(
      new NotFoundException('Матч не знайдено'),
    );
  });

  it('returns upcoming matches for team', async () => {
    const findManySpy = jest.spyOn(prisma.match, 'findMany');
    prisma.match.findMany.mockResolvedValueOnce([{ id: 'm1' }] as never);

    await expect(service.getUpcomingMatches('team-a')).resolves.toEqual([
      { id: 'm1' },
    ]);

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isProcessed: false,
          OR: [{ teamAId: 'team-a' }, { teamBId: 'team-a' }],
        },
      }),
    );
  });

  it('paginates disputed matches', async () => {
    (paginate as jest.Mock).mockResolvedValueOnce({ items: [] });

    await expect(
      service.getAllDisputedMatches({ page: 1, limit: 10 }),
    ).resolves.toEqual({ items: [] });

    expect(paginate).toHaveBeenCalledWith(
      prisma.match,
      { matchStatus: 'DISPUTED' },
      { page: 1, limit: 10 },
      expect.any(Object),
      { playedAt: 'asc' },
    );
  });

  it('checks access for tournament disputed matches', async () => {
    const accessSpy = jest.spyOn(accessPolicy, 'checkTournamentCreatorOrAdmin');
    prisma.tournament.findUnique.mockResolvedValueOnce({
      creatorId: 'u1',
    } as never);
    prisma.match.findMany.mockResolvedValueOnce([{ id: 'm1' }] as never);

    await expect(
      service.getTournamentDisputedMatches('t1', user),
    ).resolves.toEqual([{ id: 'm1' }]);

    expect(accessSpy).toHaveBeenCalledWith('u1', user);
  });
});
