/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { StatsAnalyticsService } from './stats-analytics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StatsAnalyticsService', () => {
  let service: StatsAnalyticsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StatsAnalyticsService>(StatsAnalyticsService);
  });

  it('повинен бути визначеним', () => {
    expect(service).toBeDefined();
  });

  it('getTeamRatingHistory повинен повертати історію команди', async () => {
    const mockResult = [{ id: 'history-1' }];
    prisma.ratingHistory.findMany.mockResolvedValueOnce(mockResult as never);

    const result = await service.getTeamRatingHistory('team-1');

    expect(result).toEqual(mockResult);
    expect(prisma.ratingHistory.findMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1' },
      orderBy: { createdAt: 'asc' },
      include: {
        match: { select: { tournament: { select: { title: true } } } },
      },
    });
  });

  it('getPlayerRatingHistory повинен повертати історію гравця', async () => {
    const mockResult = [{ id: 'history-2' }];
    prisma.ratingHistory.findMany.mockResolvedValueOnce(mockResult as never);

    const result = await service.getPlayerRatingHistory('player-1');

    expect(result).toEqual(mockResult);
    expect(prisma.ratingHistory.findMany).toHaveBeenCalledWith({
      where: { playerId: 'player-1' },
      orderBy: { createdAt: 'asc' },
      include: {
        match: { select: { tournament: { select: { title: true } } } },
      },
    });
  });
});
