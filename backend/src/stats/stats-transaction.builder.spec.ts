/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { Stage, Bracket } from '@prisma/client';
import { StatsTransactionBuilder } from './stats-transaction.builder';
import { EloCalculatorService } from './elo-calculator.service';
import { PlayerStatsAggregatorService } from './player-stats-aggregator.service';

jest.mock('common/helpers/tier.helper', () => ({
  TierHelper: {
    calculateTier: jest.fn().mockReturnValue('S'),
  },
}));

describe('StatsTransactionBuilder', () => {
  let builder: StatsTransactionBuilder;
  let eloCalculator: MockProxy<EloCalculatorService>;
  let statsAggregator: MockProxy<PlayerStatsAggregatorService>;

  beforeEach(async () => {
    eloCalculator = mock<EloCalculatorService>();
    statsAggregator = mock<PlayerStatsAggregatorService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsTransactionBuilder,
        { provide: EloCalculatorService, useValue: eloCalculator },
        { provide: PlayerStatsAggregatorService, useValue: statsAggregator },
      ],
    }).compile();

    builder = module.get<StatsTransactionBuilder>(StatsTransactionBuilder);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildTeamMatchUpdates', () => {
    it('формує правильний об`єкт оновлень для команд', () => {
      eloCalculator.calculateElo.mockReturnValue({ changeA: 15, changeB: -15 });

      const match = {
        id: 'm1',
        stage: Stage.PLAYOFF,
        bracket: Bracket.UPPER,
        teamAId: 'team-a',
        teamBId: 'team-b',
        scoreA: 2,
        scoreB: 1,
      };

      const result = builder.buildTeamMatchUpdates(match, 1, 1500, 1400);

      expect(eloCalculator.calculateElo).toHaveBeenCalledWith(
        1500,
        1400,
        true,
        1,
        Stage.PLAYOFF,
        Bracket.UPPER,
      );
      expect(result.isAWinner).toBe(true);

      expect(result.teamA).toEqual({
        id: 'team-a',
        newRating: 1515,
        newTier: 'S',
      });
      expect(result.teamB).toEqual({
        id: 'team-b',
        newRating: 1385,
        newTier: 'S',
      });

      expect(result.historyA.ratingChange).toBe(15);
      expect(result.historyB.ratingChange).toBe(-15);
    });
    it('формує правильний об`єкт оновлень коли перемагає команда B', () => {
      eloCalculator.calculateElo.mockReturnValue({ changeA: -15, changeB: 15 });

      const match = {
        id: 'm2',
        stage: Stage.PLAYOFF,
        bracket: Bracket.UPPER,
        teamAId: 'team-a',
        teamBId: 'team-b',
        scoreA: 1,
        scoreB: 2, // Команда B виграла
      };

      const result = builder.buildTeamMatchUpdates(match, 1, 1400, 1500);

      expect(eloCalculator.calculateElo).toHaveBeenCalledWith(
        1400,
        1500,
        false, // isAWinner = false
        1,
        Stage.PLAYOFF,
        Bracket.UPPER,
      );
      expect(result.isAWinner).toBe(false);
      expect(result.historyB.ratingChange).toBe(15);
      expect(result.historyA.ratingChange).toBe(-15);
    });
  });

  describe('buildPlayerStatsUpdates', () => {
    it('формує правильний об`єкт оновлень для гравців', () => {
      const mockNewStats = { total_kills: 100 };
      statsAggregator.calculateNewLifetimeStats.mockReturnValue(mockNewStats);

      const result = builder.buildPlayerStatsUpdates(
        'm1',
        'p1',
        1000,
        20,
        {},
        { kills: 10 },
        true,
      );

      expect(statsAggregator.calculateNewLifetimeStats).toHaveBeenCalledWith(
        {},
        { kills: 10 },
        true,
      );
      expect(result.newRating).toBe(1020);
      expect(result.newStatsJson).toBe(mockNewStats);
      expect(result.history.ratingChange).toBe(20);
    });
  });
});
