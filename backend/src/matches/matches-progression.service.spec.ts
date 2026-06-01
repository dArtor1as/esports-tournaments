import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { MatchesProgressionService } from './matches-progression.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { MatchesProgressionLogic } from './matches-progression.logic';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

describe('MatchesProgressionService', () => {
  let service: MatchesProgressionService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let progressionLogic: MockProxy<MatchesProgressionLogic>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mock<AccessPolicyService>();
    progressionLogic = mock<MatchesProgressionLogic>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesProgressionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: MatchesProgressionLogic, useValue: progressionLogic },
      ],
    }).compile();

    service = module.get<MatchesProgressionService>(MatchesProgressionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('finalizes match progression updates', async () => {
    const prismaTx = mockDeep<Prisma.TransactionClient>();
    const match = { id: 'm1', nextMatchWinnerId: null, nextMatchLoserId: null };
    const updateSpy = jest.spyOn(prismaTx.match, 'update');

    progressionLogic.calculateProgressionUpdates.mockReturnValueOnce([
      { id: 'm1', data: { scoreA: 2, scoreB: 1 } },
    ]);
    updateSpy.mockResolvedValueOnce({ id: 'm1' } as never);

    const result = await service.finalizeMatchProgression(
      prismaTx,
      match as never,
      2,
      1,
    );

    expect(result).toEqual({ id: 'm1' });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { scoreA: 2, scoreB: 1 },
    });
  });

  it('throws when tournament not found', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(null);

    await expect(service.transitionToPlayoffs('t1', user)).rejects.toThrow(
      new NotFoundException('Турнір не знайдено'),
    );
  });

  it('throws when group matches are missing', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'u1',
    } as never);
    prisma.match.findMany.mockResolvedValueOnce([]);

    await expect(service.transitionToPlayoffs('t1', user)).rejects.toThrow(
      new BadRequestException('Групові матчі не знайдені'),
    );
  });

  it('throws when group matches are not processed', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'u1',
    } as never);
    prisma.match.findMany.mockResolvedValueOnce([
      { isProcessed: false },
    ] as never);

    await expect(service.transitionToPlayoffs('t1', user)).rejects.toThrow(
      new BadRequestException('Не всі матчі групового етапу завершені.'),
    );
  });

  it('updates seeds for playoff teams', async () => {
    const transactionSpy = jest.spyOn(
      prisma,
      '$transaction',
    ) as unknown as jest.Mock;
    const accessSpy = jest.spyOn(accessPolicy, 'checkTournamentCreatorOrAdmin');
    const updateSpy = jest.spyOn(prisma.tournamentParticipant, 'update');

    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'u1',
    } as never);
    prisma.match.findMany.mockResolvedValueOnce([
      {
        teamAId: 'team-a',
        teamBId: 'team-b',
        groupName: 'Group A',
        isProcessed: true,
        scoreA: 2,
        scoreB: 0,
      },
    ] as never);
    prisma.tournamentParticipant.findMany.mockResolvedValueOnce([
      {
        id: 'p1',
        teamId: 'team-a',
        team: { tag: 'A' },
        groupPoints: 3,
        mapsWon: 2,
        mapsLost: 0,
      },
      {
        id: 'p2',
        teamId: 'team-b',
        team: { tag: 'B' },
        groupPoints: 0,
        mapsWon: 0,
        mapsLost: 2,
      },
    ] as never);

    progressionLogic.sortGroupTeams.mockImplementation((teams) => teams);
    prisma.tournamentParticipant.update.mockResolvedValue({} as never);
    transactionSpy.mockImplementation(async (calls: unknown[]) =>
      Promise.all(calls),
    );

    await expect(service.transitionToPlayoffs('t1', user)).resolves.toEqual({
      message:
        'Перехід до плей-оф виконано. Топ-8 команд отримали нові посіви.',
      playoffTeams: [
        { seed: 1, teamId: 'team-a', tag: 'A', points: 3 },
        { seed: 2, teamId: 'team-b', tag: 'B', points: 0 },
      ],
    });

    expect(accessSpy).toHaveBeenCalledWith('u1', user);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { seed: 1 },
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: { seed: 2 },
    });
  });
});
