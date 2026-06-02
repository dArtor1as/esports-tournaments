import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Prisma, Role } from '@prisma/client';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from '../auth/access-policy.service';
import { StatsService } from '../stats/stats.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let statsService: MockProxy<StatsService>;
  let cacheManager: MockProxy<Cache>;

  const user: JwtPayload = {
    userId: 'user-1',
    email: 'user-1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mock<AccessPolicyService>();
    statsService = mock<StatsService>();
    cacheManager = mock<Cache>();

    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma as never),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: StatsService, useValue: statsService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates tournament when game exists', async () => {
    prisma.game.findUnique.mockResolvedValueOnce({ id: 'game-1' } as never);
    prisma.tournament.create.mockResolvedValueOnce({ id: 't1' } as never);
    const createSpy = jest.spyOn(prisma.tournament, 'create');

    await expect(
      service.create(
        {
          title: 'Cup',
          gameId: 'game-1',
          tier: 2,
          isPublic: true,
          kFactor: 0.6,
        },
        'user-1',
      ),
    ).resolves.toBeDefined();

    expect(createSpy.mock.calls.length).toBe(1);
    const createArgs = createSpy.mock
      .calls[0]?.[0] as Prisma.TournamentCreateArgs;
    expect(createArgs.data).toMatchObject({
      title: 'Cup',
      gameId: 'game-1',
      tier: 2,
      kFactor: 0.6,
      format: 'TEAM',
      maxParticipants: 16,
      creatorId: 'user-1',
    });
  });

  it('throws when game is missing on create', async () => {
    prisma.game.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          title: 'Cup',
          gameId: 'game-1',
          tier: 3,
          isPublic: true,
          kFactor: 0.3,
        },
        'user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates tournament and checks access', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      status: 'planned',
    } as never);
    prisma.tournament.update.mockResolvedValueOnce({ id: 't1' } as never);

    const result = await service.update('t1', { title: 'New' }, user);

    expect(accessPolicy.checkTournamentCreatorOrAdmin.mock.calls[0]).toEqual([
      'user-1',
      user,
    ]);
    expect(result).toHaveProperty('id');
  });

  it('rejects format change after tournament start', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      status: 'live',
    } as never);

    await expect(
      service.update('t1', { format: 'TEAM' } as never, user),
    ).rejects.toThrow(BadRequestException);
  });

  it('cancels tournament and updates matches', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      status: 'live',
    } as never);

    const cancelResult = (await service.cancelTournament('t1', user)) as {
      message: string;
    };

    expect(accessPolicy.checkTournamentCreatorOrAdmin.mock.calls[0]).toEqual([
      'user-1',
      user,
    ]);
    expect(prisma.match.updateMany.mock.calls.length).toBe(1);
    expect(prisma.tournament.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 't1' },
      data: { status: 'cancelled' },
    });
    expect(typeof cancelResult.message).toBe('string');
  });

  it('finishes tournament after stats are processed', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'live',
      matches: [{ isProcessed: true }],
    } as never);
    //  Мокаємо повернення оновленого турніру
    prisma.tournament.update.mockResolvedValueOnce({
      id: 't1',
      status: 'finished',
    } as never);

    const finishResult = (await service.finishTournament('t1', user)) as {
      tournament: unknown;
    };

    expect(statsService.processTournamentStats.mock.calls[0]).toEqual([
      't1',
      user,
    ]);
    expect(prisma.tournament.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 't1' },
      data: { status: 'finished' },
    });
    expect(finishResult.tournament).toBeDefined();
  });

  it('blocks finish when unprocessed matches exist', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'live',
      matches: [{ isProcessed: false }],
    } as never);

    await expect(service.finishTournament('t1', user)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when finishing an already finished or cancelled tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'finished',
      matches: [],
    } as never);

    await expect(service.finishTournament('t1', user)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('removes tournament and related data', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      matches: [],
    } as never);
    prisma.tournament.delete.mockResolvedValueOnce({ id: 't1' } as never);

    await expect(service.remove('t1', user)).resolves.toHaveProperty('id');

    expect(accessPolicy.checkTournamentCreatorOrAdmin.mock.calls[0]).toEqual([
      'user-1',
      user,
    ]);
    expect(prisma.tournamentRoster.deleteMany.mock.calls.length).toBe(1);
    expect(prisma.tournamentParticipant.deleteMany.mock.calls.length).toBe(1);
    expect(prisma.tournamentInvitation.deleteMany.mock.calls.length).toBe(1);
    expect(prisma.simulationRun.deleteMany.mock.calls.length).toBe(1);
    expect(prisma.tournament.delete.mock.calls[0]?.[0]).toEqual({
      where: { id: 't1' },
    });
  });

  it('throws when removing tournament with matches', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      matches: [{ id: 'm1' }],
    } as never);

    await expect(service.remove('t1', user)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when tournament does not exist on update', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(null);

    await expect(service.update('t1', { title: 'x' }, user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when tournament does not exist on cancel', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(null);

    await expect(service.cancelTournament('t1', user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when tournament does not exist on finish', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(null);

    await expect(service.finishTournament('t1', user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when canceling finished tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      status: 'finished',
    } as never);

    await expect(service.cancelTournament('t1', user)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('creates tournament with default format if format is not provided', async () => {
    prisma.game.findUnique.mockResolvedValueOnce({ id: 'game-1' } as never);
    prisma.tournament.create.mockResolvedValueOnce({
      id: 't-default',
    } as never);
    const createSpy = jest.spyOn(prisma.tournament, 'create');

    await service.create(
      {
        title: 'Default Cup',
        gameId: 'game-1',
        tier: 1,
        kFactor: 1.0,
        isPublic: true,
      },
      'user-1',
    );

    const createArgs = createSpy.mock
      .calls[0]?.[0] as Prisma.TournamentCreateArgs;
    expect(createArgs.data.format).toBe('TEAM');
  });

  it('allows format change if tournament status is still planned', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      status: 'planned',
    } as never);
    prisma.tournament.update.mockResolvedValueOnce({ id: 't1' } as never);

    await service.update('t1', { format: 'SOLO' } as never, user);

    const updateArgs = prisma.tournament.update.mock
      .calls[0]?.[0] as Prisma.TournamentUpdateArgs;
    expect(updateArgs.data.format).toBe('SOLO');
  });

  it('throws when canceling an already cancelled tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      status: 'cancelled',
    } as never);

    await expect(service.cancelTournament('t1', user)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('creates tournament with tier 3 and custom settings', async () => {
    prisma.game.findUnique.mockResolvedValueOnce({ id: 'game-1' } as never);
    prisma.tournament.create.mockResolvedValueOnce({ id: 't3' } as never);

    const createSpy = jest.spyOn(prisma.tournament, 'create');

    await service.create(
      {
        title: 'Tier 3 Cup',
        gameId: 'game-1',
        tier: 3,
        kFactor: 0.3,
        isPublic: true,
        settings: { pointsPerWin: 5 },
      },
      'user-1',
    );

    const createArgs = createSpy.mock
      .calls[0]?.[0] as Prisma.TournamentCreateArgs;
    expect(createArgs.data.kFactor).toBe(0.3);
    expect(createArgs.data.settings).toEqual({ pointsPerWin: 5 });
  });

  it('allows updating title when tournament is live (ignores format/gameId check)', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      creatorId: 'user-1',
      status: 'live',
    } as never);
    prisma.tournament.update.mockResolvedValueOnce({ id: 't1' } as never);

    await service.update('t1', { title: 'New Title' } as never, user);

    const updateArgs = prisma.tournament.update.mock
      .calls[0]?.[0] as Prisma.TournamentUpdateArgs;
    expect(updateArgs.data.title).toBe('New Title');
  });

  it('throws when tournament does not exist on remove', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(null);

    await expect(service.remove('t1', user)).rejects.toThrow(NotFoundException);
  });
});
