import { Injectable } from '@nestjs/common';
import { Prisma, Stage, Bracket } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EloCalculatorService } from './elo-calculator.service';
import {
  PlayerStatsAggregatorService,
  PlayerStatsData,
} from './player-stats-aggregator.service';
import { TeamsService } from '../teams/teams.service';

@Injectable()
export class StatsTransactionBuilder {
  constructor(
    private prisma: PrismaService,
    private eloCalculator: EloCalculatorService,
    private statsAggregator: PlayerStatsAggregatorService,
    private teamsService: TeamsService,
  ) {}

  //  розраховуємо нові рейтинги команд та формуємо масив запитів
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
    const newTierA = this.teamsService.calculateTier(newRatingA);
    const newTierB = this.teamsService.calculateTier(newRatingB);

    const queries: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.team.update({
        where: { id: match.teamAId },
        data: { averageRating: newRatingA, tier: newTierA },
      }),
      this.prisma.team.update({
        where: { id: match.teamBId },
        data: { averageRating: newRatingB, tier: newTierB },
      }),
      this.prisma.ratingHistory.create({
        data: {
          teamId: match.teamAId,
          matchId: match.id,
          oldRating: ratingA,
          newRating: newRatingA,
          ratingChange: changeA,
        },
      }),
      this.prisma.ratingHistory.create({
        data: {
          teamId: match.teamBId,
          matchId: match.id,
          oldRating: ratingB,
          newRating: newRatingB,
          ratingChange: changeB,
        },
      }),
    ];

    return { queries, newRatingA, newRatingB, changeA, changeB, isAWinner };
  }

  // Розраховуємо нову статистику гравця та формуємо масив запитів
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

    const queries: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.player.update({
        where: { id: playerId },
        data: {
          rating: newRating,
          stats: newStatsJson as Prisma.InputJsonValue,
        },
      }),
      this.prisma.ratingHistory.create({
        data: {
          playerId: playerId,
          matchId: matchId,
          oldRating: currentRating,
          newRating: newRating,
          ratingChange: eloChange,
        },
      }),
    ];

    return { queries, newRating, newStatsJson };
  }
}
