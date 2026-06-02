import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Stage } from '@prisma/client';
import { TournamentsWorkflowService } from './tournaments-workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('TournamentsWorkflowService', () => {
  let service: TournamentsWorkflowService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockCacheManager = {
    del: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<TournamentsWorkflowService>(
      TournamentsWorkflowService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findWorkflow', () => {
    it('returns workflow list with readiness flags', async () => {
      prisma.tournament.findMany.mockResolvedValueOnce([
        {
          id: 't1',
          title: 'Cup 1',
          status: 'live',
          format: 'TEAM',
          game: { name: 'CS2' },
          _count: { participants: 16, matches: 30 },
        } as never,
      ]);

      // Використовуємо jest.Mock, щоб обійти баг типізації Prisma groupBy
      (prisma.match.groupBy as jest.Mock).mockResolvedValueOnce([
        { tournamentId: 't1', stage: Stage.GROUP, _count: { _all: 24 } },
        { tournamentId: 't1', stage: Stage.PLAYOFF, _count: { _all: 6 } },
      ]);

      const result = await service.findWorkflow('simulation');

      expect(prisma.tournament.findMany.mock.calls.length).toBe(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 't1',
        hasGeneratedGrid: true,
        requiresTransitionToPlayoffs: false,
        groupMatches: 24,
        playoffMatches: 6,
      });
    });

    it('keeps generation workflow available after transition when no playoff matches yet', async () => {
      prisma.tournament.findMany.mockResolvedValueOnce([
        {
          id: 't2',
          title: 'Cup 2',
          status: 'live',
          format: 'TEAM',
          game: { name: 'CS2' },
          _count: { participants: 16, matches: 24 },
        } as never,
      ]);

      (prisma.match.groupBy as jest.Mock).mockResolvedValueOnce([
        { tournamentId: 't2', stage: Stage.GROUP, _count: { _all: 24 } },
      ]);

      const result = await service.findWorkflow('generation');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 't2',
        canGenerateBracket: true,
        requiresTransitionToPlayoffs: true,
        groupMatches: 24,
        playoffMatches: 0,
      });
    });
    it('filters by valid status without throwing', async () => {
      prisma.tournament.findMany.mockResolvedValueOnce([]);
      (prisma.match.groupBy as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.findWorkflow(undefined, 'planned');

      // Перевіряємо, що where сформувався правильно
      expect(prisma.tournament.findMany.mock.calls[0][0]).toMatchObject({
        where: { status: 'planned' },
      });
      expect(result).toEqual([]);
    });

    it('returns all when no filters applied', async () => {
      prisma.tournament.findMany.mockResolvedValueOnce([]);
      (prisma.match.groupBy as jest.Mock).mockResolvedValueOnce([]);

      await service.findWorkflow(undefined, undefined);

      expect(prisma.tournament.findMany.mock.calls[0][0]).toMatchObject({
        where: {},
      });
    });

    it('rejects invalid workflow mode', async () => {
      await expect(service.findWorkflow('random')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid status', async () => {
      await expect(service.findWorkflow(undefined, 'INVALID')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateTestTournament', () => {
    it('throws BadRequestException when game is not found', async () => {
      prisma.game.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.generateTestTournament(
          { teamCount: 16, title: 'Test Cup', isPublic: true },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a test tournament with explicit gameId', async () => {
      prisma.game.findUnique.mockResolvedValueOnce({ id: 'g1' } as never);

      prisma.team.findMany.mockResolvedValueOnce(
        Array.from({ length: 16 }, (_, idx) => ({
          id: `team-${idx + 1}`,
          players: [],
        })) as never,
      );

      prisma.tournament.create.mockResolvedValueOnce({
        id: 't-created',
      } as never);

      const result = await service.generateTestTournament(
        {
          gameId: 'g1',
          teamCount: 16,
          title: 'Test Cup',
          isPublic: true,
        },
        'user-1',
      );

      expect(prisma.game.findUnique.mock.calls[0][0]).toEqual({
        where: { id: 'g1' },
      });
      expect(prisma.tournament.create.mock.calls.length).toBe(1);
      expect(typeof result.participantsCount).toBe('number');
    });

    it('creates a test tournament falling back to slug cs2 when no gameId provided', async () => {
      prisma.game.findUnique.mockResolvedValueOnce({ id: 'g-cs2' } as never);

      prisma.team.findMany.mockResolvedValueOnce(
        Array.from({ length: 4 }, (_, idx) => ({
          id: `team-${idx + 1}`,
          players: [],
        })) as never,
      );

      prisma.tournament.create.mockResolvedValueOnce({
        id: 't-created-2',
      } as never);

      const result = await service.generateTestTournament(
        {
          teamCount: 4,
          title: 'CS2 Cup',
          isPublic: true,
        },
        'user-1',
      );

      expect(prisma.game.findUnique.mock.calls[0][0]).toEqual({
        where: { slug: 'cs2' },
      });
      expect(prisma.tournament.create.mock.calls.length).toBe(1);
      expect(result.participantsCount).toBe(4);
    });
  });
});
