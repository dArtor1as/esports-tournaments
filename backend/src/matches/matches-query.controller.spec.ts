import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { MatchesQueryController } from './matches-query.controller';
import { MatchesQueryService } from './matches-query.service';
import { MatchesQueryDto } from './dto/matches-query.dto';
import { PaginationQueryDto } from 'common/dto/pagination-query.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role, Stage } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('MatchesQueryController', () => {
  let controller: MatchesQueryController;
  let queryService: MockProxy<MatchesQueryService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    queryService = mock<MatchesQueryService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesQueryController],
      providers: [
        { provide: MatchesQueryService, useValue: queryService },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MatchesQueryController>(MatchesQueryController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getRecent delegates to service', async () => {
    const recentSpy = jest.spyOn(queryService, 'getRecentResults');
    queryService.getRecentResults.mockResolvedValueOnce([
      { id: 'm1' },
    ] as never);

    await expect(controller.getRecent()).resolves.toEqual([{ id: 'm1' }]);
    expect(recentSpy).toHaveBeenCalledTimes(1);
  });

  it('getGlobalDisputed delegates to service', async () => {
    const query: PaginationQueryDto = { page: 1, limit: 10 };
    const disputedSpy = jest.spyOn(queryService, 'getAllDisputedMatches');
    queryService.getAllDisputedMatches.mockResolvedValueOnce({
      items: [],
      meta: { totalItems: 0 },
    } as never);

    await expect(controller.getGlobalDisputed(query)).resolves.toMatchObject({
      items: [],
    });
    expect(disputedSpy).toHaveBeenCalledWith(query);
  });

  it('getTournamentDisputed delegates to service', async () => {
    const tournamentSpy = jest.spyOn(
      queryService,
      'getTournamentDisputedMatches',
    );
    queryService.getTournamentDisputedMatches.mockResolvedValueOnce(
      [] as never,
    );

    await expect(controller.getTournamentDisputed('t1', user)).resolves.toEqual(
      [],
    );
    expect(tournamentSpy).toHaveBeenCalledWith('t1', user);
  });

  it('findAllByTournament delegates with formatted stage', async () => {
    const query: MatchesQueryDto = {
      stage: 'PLAYOFF',
    } as unknown as MatchesQueryDto;
    const findSpy = jest.spyOn(queryService, 'findAllByTournament');
    queryService.findAllByTournament.mockResolvedValueOnce([
      { id: 'm1' },
    ] as never);

    await expect(controller.findAllByTournament('t1', query)).resolves.toEqual([
      { id: 'm1' },
    ]);
    expect(findSpy).toHaveBeenCalledWith('t1', Stage.PLAYOFF);
  });

  it('getUpcoming delegates to service', async () => {
    const upcomingSpy = jest.spyOn(queryService, 'getUpcomingMatches');
    queryService.getUpcomingMatches.mockResolvedValueOnce([
      { id: 'm1' },
    ] as never);

    await expect(controller.getUpcoming('team1')).resolves.toEqual([
      { id: 'm1' },
    ]);
    expect(upcomingSpy).toHaveBeenCalledWith('team1');
  });

  it('getTeamMatchesHistory delegates to service', async () => {
    const query: PaginationQueryDto = { page: 1, limit: 5 };
    const historySpy = jest.spyOn(queryService, 'getTeamMatchesHistory');
    queryService.getTeamMatchesHistory.mockResolvedValueOnce({
      items: [],
    } as never);

    await expect(
      controller.getTeamMatchesHistory('team1', query),
    ).resolves.toMatchObject({ items: [] });
    expect(historySpy).toHaveBeenCalledWith('team1', query);
  });

  it('getPlayerMatchesHistory delegates to service', async () => {
    const query: PaginationQueryDto = { page: 1, limit: 5 };
    const historySpy = jest.spyOn(queryService, 'getPlayerMatchesHistory');
    queryService.getPlayerMatchesHistory.mockResolvedValueOnce({
      items: [],
    } as never);

    await expect(
      controller.getPlayerMatchesHistory('player1', query),
    ).resolves.toMatchObject({ items: [] });
    expect(historySpy).toHaveBeenCalledWith('player1', query);
  });

  it('findOne delegates to service', async () => {
    const findSpy = jest.spyOn(queryService, 'findOne');
    queryService.findOne.mockResolvedValueOnce({ id: 'm1' } as never);

    await expect(controller.findOne('m1')).resolves.toEqual({ id: 'm1' });
    expect(findSpy).toHaveBeenCalledWith('m1');
  });
});
