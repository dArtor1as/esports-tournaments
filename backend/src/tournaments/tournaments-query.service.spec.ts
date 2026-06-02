import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Region } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { TournamentsQueryService } from './tournaments-query.service';
import { PrismaService } from '../prisma/prisma.service';
import * as paginateUtil from 'common/utils/paginate.util';
import type { PaginatedResult } from 'common/utils/paginate.util';

describe('TournamentsQueryService', () => {
  let service: TournamentsQueryService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsQueryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TournamentsQueryService>(TournamentsQueryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes filters to paginate on findAll', async () => {
    const response: PaginatedResult<unknown> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    const paginateSpy = jest
      .spyOn(paginateUtil, 'paginate')
      .mockResolvedValue(response as never);

    const query = {
      title: 'cup',
      gameSlug: 'cs2',
      region: Region.GLOBAL,
      status: 'live',
      tier: 2,
      isPublic: 'true',
      page: 1,
      limit: 10,
    };

    const result = await service.findAll(query);

    expect(paginateSpy).toHaveBeenCalledWith(
      prisma.tournament,
      {
        game: { slug: 'cs2' },
        region: Region.GLOBAL,
        status: 'live',
        tier: 2,
        isPublic: true,
        title: { contains: 'cup', mode: 'insensitive' },
      },
      query,
      {
        game: { select: { name: true, slug: true } },
        _count: { select: { participants: true } },
      },
      { createdAt: 'desc' },
    );
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('passes creator filter to paginate on findMyTournaments', async () => {
    const response: PaginatedResult<unknown> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    const paginateSpy = jest
      .spyOn(paginateUtil, 'paginate')
      .mockResolvedValue(response as never);

    const result = await service.findMyTournaments('user-1', { page: 1 });

    expect(paginateSpy).toHaveBeenCalledWith(
      prisma.tournament,
      { creatorId: 'user-1' },
      { page: 1 },
      {
        game: { select: { name: true, slug: true } },
        _count: { select: { participants: true, matches: true } },
      },
      { createdAt: 'desc' },
    );
    expect(typeof result.meta.total).toBe('number');
  });

  it('returns tournament when found', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce({ id: 't1' } as never);

    const result = await service.findOne('t1');

    expect(result).toHaveProperty('id');
  });

  it('throws when tournament not found', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne('t1')).rejects.toThrow(NotFoundException);
  });
  it('correctly formats where input with isPublic=false', async () => {
    const response: PaginatedResult<unknown> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    const paginateSpy = jest
      .spyOn(paginateUtil, 'paginate')
      .mockResolvedValue(response as never);

    const query = {
      isPublic: 'false',
      page: 1,
      limit: 10,
    };

    await service.findAll(query);

    expect(paginateSpy.mock.calls[0][1]).toMatchObject({
      isPublic: false,
    });
  });
});
