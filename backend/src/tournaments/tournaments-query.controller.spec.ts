import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TournamentsQueryController } from './tournaments-query.controller';
import { TournamentsQueryService } from './tournaments-query.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { PaginatedResult } from 'common/utils/paginate.util';

describe('TournamentsQueryController', () => {
  let controller: TournamentsQueryController;
  let queryService: MockProxy<TournamentsQueryService>;

  const user: JwtPayload = {
    userId: 'user-1',
    email: 'user-1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    queryService = mock<TournamentsQueryService>();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentsQueryController],
      providers: [
        { provide: TournamentsQueryService, useValue: queryService },
        { provide: CACHE_MANAGER, useValue: {} }, // ВИПРАВЛЕНО: додано Cache Manager
      ],
    }).compile();

    controller = module.get<TournamentsQueryController>(
      TournamentsQueryController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns tournaments list via service', async () => {
    const response: PaginatedResult<unknown> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    queryService.findAll.mockResolvedValueOnce(response as never);

    const result = await controller.findAll({ page: 1 } as never);

    expect(queryService.findAll.mock.calls[0]).toEqual([{ page: 1 }]);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('returns my tournaments via service', async () => {
    const response: PaginatedResult<unknown> = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    queryService.findMyTournaments.mockResolvedValueOnce(response as never);

    const result = await controller.findMyTournaments(user, {
      page: 2,
    } as never);

    expect(queryService.findMyTournaments.mock.calls[0]).toEqual([
      'user-1',
      { page: 2 },
    ]);
    expect(result.meta).toHaveProperty('total');
  });

  it('returns tournament details via service', async () => {
    queryService.findOne.mockResolvedValueOnce({ id: 't1' } as never);

    const result = await controller.findOne('t1');

    expect(queryService.findOne.mock.calls[0]).toEqual(['t1']);
    expect(result).toHaveProperty('id');
  });
});
