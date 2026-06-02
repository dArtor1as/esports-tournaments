import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LeaderboardsService } from './leaderboards.service';
import { PrismaService } from '../prisma/prisma.service';
import * as paginateUtil from 'common/utils/paginate.util';
import type { PaginatedResult } from 'common/utils/paginate.util';
import { Region } from '@prisma/client';

describe('LeaderboardsService', () => {
  let service: LeaderboardsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeaderboardsService>(LeaderboardsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getTeamsLeaderboard', () => {
    it('calls paginate with base parameters when no filters provided', async () => {
      const response: PaginatedResult<unknown> = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      const paginateSpy = jest
        .spyOn(paginateUtil, 'paginate')
        .mockResolvedValueOnce(response as never);

      await service.getTeamsLeaderboard({});

      // Перевіряємо args, які передаються в paginate
      // paginate(prisma.team, where, query, include, orderBy)
      const callArgs = paginateSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({ status: 'ACTIVE' }); // where

      // уточнюємо, що include та orderBy передаються з правильними параметрами
      expect(callArgs[3]).toEqual({
        game: true,
        players: { select: { id: true, nickname: true, teamRole: true } },
      });

      expect(callArgs[4]).toEqual({ averageRating: 'desc' }); // orderBy
    });

    it('calls paginate with region and gameSlug filters', async () => {
      const response: PaginatedResult<unknown> = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      const paginateSpy = jest
        .spyOn(paginateUtil, 'paginate')
        .mockResolvedValueOnce(response as never);

      await service.getTeamsLeaderboard({
        region: Region.EU,
        gameSlug: 'cs2',
      });

      const callArgs = paginateSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({
        status: 'ACTIVE',
        region: Region.EU,
        game: { slug: 'cs2' },
      });
    });
  });

  describe('getPlayersLeaderboard', () => {
    it('calls paginate with empty where when no filters provided', async () => {
      const response: PaginatedResult<unknown> = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      const paginateSpy = jest
        .spyOn(paginateUtil, 'paginate')
        .mockResolvedValueOnce(response as never);

      await service.getPlayersLeaderboard({});

      const callArgs = paginateSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({}); // where
      expect(callArgs[4]).toEqual({ rating: 'desc' }); // orderBy
    });

    it('calls paginate with region and gameSlug filters', async () => {
      const response: PaginatedResult<unknown> = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      const paginateSpy = jest
        .spyOn(paginateUtil, 'paginate')
        .mockResolvedValueOnce(response as never);

      await service.getPlayersLeaderboard({
        region: Region.NA,
        gameSlug: 'dota2',
      });

      const callArgs = paginateSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({
        team: { region: Region.NA },
        game: { slug: 'dota2' },
      });
    });
  });
});
