import { Injectable } from '@nestjs/common';
import { Prisma, Stage, Bracket } from '@prisma/client';
import { EloCalculatorService } from './elo-calculator.service';
import {
  PlayerStatsAggregatorService,
  PlayerStatsData,
} from './player-stats-aggregator.service';
import { TierHelper } from '/common/helpers/tier.helper';

@Injectable()
export class StatsTransactionBuilder {
  constructor(
    private eloCalculator: EloCalculatorService,
    private statsAggregator: PlayerStatsAggregatorService,
  ) {}

  // Повертає тільки ДАНІ для оновлення, без викликів Prisma
  public buildTeamMatchUpdates(
    match: {
      id: string;
      stage: Stage;
      bracket: Bracket;
      teamAId: string;
      teamBId: string;
      scoreA: number;
      scoreB: number;
    },
    kFactor: number,
    ratingA: number,
    ratingB: number,
  ) {
    const isAWinner = match.scoreA > match.scoreB;

    const { changeA, changeB } = this.eloCalculator.calculateElo(
      ratingA,
      ratingB,
      isAWinner,
      kFactor,
      match.stage,
      match.bracket,
    );

    const newRatingA = ratingA + changeA;
    const newRatingB = ratingB + changeB;

    return {
      isAWinner,
      teamA: {
        id: match.teamAId,
        newRating: newRatingA,
        newTier: TierHelper.calculateTier(newRatingA),
      },
      teamB: {
        id: match.teamBId,
        newRating: newRatingB,
        newTier: TierHelper.calculateTier(newRatingB),
      },
      historyA: {
        teamId: match.teamAId,
        matchId: match.id,
        oldRating: ratingA,
        newRating: newRatingA,
        ratingChange: changeA,
      },
      historyB: {
        teamId: match.teamBId,
        matchId: match.id,
        oldRating: ratingB,
        newRating: newRatingB,
        ratingChange: changeB,
      },
    };
  }

  // Те саме для гравців: повертаємо лише дані
  public buildPlayerStatsUpdates(
    matchId: string,
    playerId: string,
    currentRating: number,
    eloChange: number,
    oldStats: PlayerStatsData,
    sessionStats: Record<string, unknown>,
    isWinner: boolean,
  ) {
    const newRating = currentRating + eloChange;
    const newStatsJson = this.statsAggregator.calculateNewLifetimeStats(
      oldStats,
      sessionStats,
      isWinner,
    );

    return {
      playerId,
      newRating,
      newStatsJson: newStatsJson as Prisma.InputJsonValue,
      history: {
        playerId,
        matchId,
        oldRating: currentRating,
        newRating,
        ratingChange: eloChange,
      },
    };
  }
}
