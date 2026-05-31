import { Test, TestingModule } from '@nestjs/testing';
import {
  PlayerStatsAggregatorService,
  PlayerStatsData,
} from './player-stats-aggregator.service';
import { BaseMapStat } from './stats.types';

describe('PlayerStatsAggregatorService', () => {
  let service: PlayerStatsAggregatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayerStatsAggregatorService],
    }).compile();

    service = module.get<PlayerStatsAggregatorService>(
      PlayerStatsAggregatorService,
    );
  });

  describe('getSummedPlayerStatsForMatch', () => {
    it('повинен сумувати статистику гравців за кілька карт', () => {
      const mockMaps: BaseMapStat[] = [
        {
          mapName: 'Mirage',
          durationMinutes: 40,
          teamA: {
            score: 13,
            players: [{ playerId: 'p1', kills: 10, deaths: 5, adr: 80 }],
          },
          teamB: { score: 10, players: [] },
        },
        {
          mapName: 'Inferno',
          durationMinutes: 45,
          teamA: {
            score: 13,
            players: [{ playerId: 'p1', kills: 15, deaths: 10, adr: 90 }],
          },
          teamB: { score: 11, players: [] },
        },
      ] as unknown as BaseMapStat[];

      const result = service.getSummedPlayerStatsForMatch(mockMaps, 'teamA');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        playerId: 'p1',
        kills: 25, // 10 + 15
        deaths: 15, // 5 + 10
        adr: 170, // 80 + 90 (сума, яка потім поділиться на кількість карт в Lifetime)
        mapCount: 2,
      });
    });
  });

  describe('calculateNewLifetimeStats', () => {
    it('повинен коректно оновлювати lifetime статистику та вираховувати похідні метрики', () => {
      const oldStats: PlayerStatsData = {
        matchesPlayed: 10,
        totalMapsPlayed: 20,
        winRate: '50.00',
        total_kills: 400,
        total_roundsPlayed: 500,
        avg_adr: '90', // Додано для перевірки rule.avg
      };

      const sessionStats = {
        mapCount: 2,
        kills: 40,
        roundsPlayed: 50,
        adr: 120, // Додано для перевірки rule.avg
      };

      const result = service.calculateNewLifetimeStats(
        oldStats,
        sessionStats,
        true,
      );

      expect(result.matchesPlayed).toBe(11);
      expect(result.totalMapsPlayed).toBe(22);
      expect(result.winRate).toBe('54.55');
      expect(result.total_kills).toBe(440);
      expect(result.total_roundsPlayed).toBe(550);
      expect(result.kpr).toBe('0.80');
      // Перевіряємо гілку rule.avg
      expect(result.avg_adr).toBeDefined();
    });

    it('повинен ігнорувати невідомі ключі з сесії', () => {
      const result = service.calculateNewLifetimeStats(
        {},
        { unknownField: 100, kills: 10 },
        true,
      );
      expect(result.total_unknownField).toBeUndefined();
      expect(result.total_kills).toBe(10);
    });
    it('повинен коректно опрацьовувати існуючі дані (без фолбеків) та 0 зіграних раундів', () => {
      const oldStats: PlayerStatsData = {
        matchesPlayed: 5, // Вже є зіграні матчі (обходимо || 0)
        totalMapsPlayed: 10,
        winRate: '60',
        avg_kills: '15',
        total_kills: 150,
        total_roundsPlayed: 0, // Змушуємо тернарний вираз KPR/DPR повернути null
      };

      const sessionStats = { mapCount: 1, kills: 20 };
      const result = service.calculateNewLifetimeStats(
        oldStats,
        sessionStats,
        false,
      );

      expect(result.matchesPlayed).toBe(6);
      expect(result.totalMapsPlayed).toBe(11);
      // Оскільки total_roundsPlayed = 0, похідні метрики не мають вираховуватись
      expect(result.kpr).toBeUndefined();
    });
  });
});
