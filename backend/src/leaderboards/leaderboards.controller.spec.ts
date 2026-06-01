import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { mock, MockProxy } from 'jest-mock-extended';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import type { PaginatedResult } from 'common/utils/paginate.util';

describe('LeaderboardsController', () => {
  let controller: LeaderboardsController;
  let service: MockProxy<LeaderboardsService>;

  beforeEach(async () => {
    service = mock<LeaderboardsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardsController],
      providers: [
        { provide: LeaderboardsService, useValue: service },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<LeaderboardsController>(LeaderboardsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getTeams delegates to service', async () => {
    const mockResponse: PaginatedResult<unknown> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    service.getTeamsLeaderboard.mockResolvedValueOnce(mockResponse as never);

    const query = { page: 1 } as LeaderboardQueryDto;
    const result = await controller.getTeams(query);

    expect(service.getTeamsLeaderboard.mock.calls[0]).toEqual([query]);
    expect(result).toBe(mockResponse);
  });

  it('getPlayers delegates to service', async () => {
    const mockResponse: PaginatedResult<unknown> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    service.getPlayersLeaderboard.mockResolvedValueOnce(mockResponse as never);

    const query = { page: 2 } as LeaderboardQueryDto;
    const result = await controller.getPlayers(query);

    expect(service.getPlayersLeaderboard.mock.calls[0]).toEqual([query]);
    expect(result).toBe(mockResponse);
  });
});
