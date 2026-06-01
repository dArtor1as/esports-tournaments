import { ProbabilityCalculatorService } from './probability-calculator.service';
import { Bracket, Match, MatchStatus, Stage } from '@prisma/client';

const buildMatch = (overrides: Partial<Match>): Match => ({
  id: 'm1',
  tournamentId: 't1',
  stage: Stage.PLAYOFF,
  bracket: Bracket.UPPER,
  groupName: null,
  round: 1,
  teamAId: 'team-a',
  teamBId: 'team-b',
  scoreA: 0,
  scoreB: 0,
  bestOf: 1,
  details: null,
  stats: null,
  matchStatus: MatchStatus.COMPLETED,
  createdAt: new Date(),
  updatedAt: new Date(),
  reportedScoreA: null,
  reportedScoreB: null,
  reportedById: null,
  disputeReason: null,
  isProcessed: true,
  playedAt: null,
  nextMatchWinnerId: null,
  nextMatchLoserId: null,
  ...overrides,
});

describe('ProbabilityCalculatorService', () => {
  let service: ProbabilityCalculatorService;

  beforeEach(() => {
    service = new ProbabilityCalculatorService();
  });

  it('returns higher base probability for higher rating', () => {
    const prob = service.getBaseProbability(2000, 1000);
    expect(prob).toBeGreaterThan(0.5);
  });

  it('returns base probability when no past matches', () => {
    const prob = service.getAdjustedProbability(0.55, 'a', 'b', []);
    expect(prob).toBeCloseTo(0.55, 5);
  });

  it('applies h2h and form bonuses', () => {
    const matches = [
      buildMatch({
        id: 'm1',
        teamAId: 'a',
        teamBId: 'b',
        scoreA: 16,
        scoreB: 10,
      }),
      buildMatch({
        id: 'm2',
        teamAId: 'b',
        teamBId: 'a',
        scoreA: 12,
        scoreB: 16,
      }),
    ];

    const prob = service.getAdjustedProbability(0.5, 'a', 'b', matches);

    expect(prob).toBeCloseTo(0.6, 5);
  });

  it('clamps probability to max and min bounds', () => {
    const matches = [
      buildMatch({
        id: 'm1',
        teamAId: 'a',
        teamBId: 'b',
        scoreA: 16,
        scoreB: 0,
      }),
      buildMatch({
        id: 'm2',
        teamAId: 'a',
        teamBId: 'b',
        scoreA: 16,
        scoreB: 0,
      }),
    ];

    const high = service.getAdjustedProbability(0.98, 'a', 'b', matches);
    const low = service.getAdjustedProbability(0.02, 'b', 'a', matches);

    expect(high).toBe(0.99);
    expect(low).toBe(0.01);
  });
});
