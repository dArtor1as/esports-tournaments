/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { mock, MockProxy } from 'jest-mock-extended';
import { AnalyticsController } from './analytics.controller';
import { StatsAnalyticsService } from './stats-analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let statsAnalyticsService: MockProxy<StatsAnalyticsService>;

  beforeEach(async () => {
    statsAnalyticsService = mock<StatsAnalyticsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: StatsAnalyticsService, useValue: statsAnalyticsService },
        { provide: CACHE_MANAGER, useValue: {} }, // Мокаємо CacheManager
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('повинен бути визначеним', () => {
    expect(controller).toBeDefined();
  });

  it('getTeamHistory повинен викликати метод сервісу', async () => {
    const mockHistory = [{ id: '1', newRating: 1500 }];
    statsAnalyticsService.getTeamRatingHistory.mockResolvedValueOnce(
      mockHistory as never,
    );

    const result = await controller.getTeamHistory('team-1');
    expect(result).toEqual(mockHistory);
    expect(statsAnalyticsService.getTeamRatingHistory).toHaveBeenCalledWith(
      'team-1',
    );
  });

  it('getPlayerHistory повинен викликати метод сервісу', async () => {
    const mockHistory = [{ id: '2', newRating: 1000 }];
    statsAnalyticsService.getPlayerRatingHistory.mockResolvedValueOnce(
      mockHistory as never,
    );

    const result = await controller.getPlayerHistory('player-1');
    expect(result).toEqual(mockHistory);
    expect(statsAnalyticsService.getPlayerRatingHistory).toHaveBeenCalledWith(
      'player-1',
    );
  });
});
