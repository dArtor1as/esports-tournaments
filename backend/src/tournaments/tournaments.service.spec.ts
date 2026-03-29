import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../prisma/prisma.service';
import { Stage } from '@prisma/client';

describe('TournamentsService', () => {
  let service: TournamentsService;
  const prismaMock = {
    game: { findUnique: jest.fn() },
    tournament: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    match: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns workflow list with readiness flags', async () => {
    prismaMock.tournament.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Cup 1',
        status: 'live',
        format: 'TEAM',
        game: { name: 'CS2' },
        _count: { participants: 16, matches: 30 },
      },
    ]);

    prismaMock.match.groupBy.mockResolvedValue([
      { tournamentId: 't1', stage: Stage.GROUP, _count: { _all: 24 } },
      { tournamentId: 't1', stage: Stage.PLAYOFF, _count: { _all: 6 } },
    ]);

    const result = await service.findWorkflow('simulation');

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
    prismaMock.tournament.findMany.mockResolvedValue([
      {
        id: 't2',
        title: 'Cup 2',
        status: 'live',
        format: 'TEAM',
        game: { name: 'CS2' },
        _count: { participants: 16, matches: 24 },
      },
    ]);

    prismaMock.match.groupBy.mockResolvedValue([
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
});
