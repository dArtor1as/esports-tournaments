import { Bracket, Stage } from '@prisma/client';
import { mock } from 'jest-mock-extended';
import { DoubleEliminationStrategy } from './double-elimination.strategy';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  SimulationContext,
  SimulationMatch,
} from '../genetic-simulator.types';
import type { IMatchSimulator } from 'src/match-simulators/match-simulator.interface';

describe('DoubleEliminationStrategy', () => {
  let strategy: DoubleEliminationStrategy;
  let probabilityCalc: ProbabilityCalculatorService;
  let simulator: IMatchSimulator;

  const buildContext = (): SimulationContext => ({
    tournament: { id: 't1', settings: {}, participants: [] },
    simulator,
    pastMatches: [],
    teamRatings: { 'team-a': 1500, 'team-b': 1400 },
    teamsData: {
      'team-a': { id: 'team-a', rating: 1500, players: [] },
      'team-b': { id: 'team-b', rating: 1400, players: [] },
    },
    baseSkeleton: [
      {
        id: 'm1',
        stage: Stage.PLAYOFF,
        bracket: Bracket.UPPER,
        groupName: null,
        round: 1,
        teamAId: 'team-a',
        teamBId: 'team-b',
        scoreA: 0,
        scoreB: 0,
        bestOf: 3,
        nextMatchWinnerId: null,
        nextMatchLoserId: null,
      } satisfies SimulationMatch,
    ],
    estimatedGenesNeeded: 1,
    matchCount: 1,
  });

  beforeEach(() => {
    probabilityCalc = mock<ProbabilityCalculatorService>();
    simulator = mock<IMatchSimulator>();
    strategy = new DoubleEliminationStrategy(
      mock<PrismaService>(),
      probabilityCalc,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes simulation and returns double elimination result', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const baseProbSpy = jest.spyOn(probabilityCalc, 'getBaseProbability');
    const adjustedProbSpy = jest.spyOn(
      probabilityCalc,
      'getAdjustedProbability',
    );
    const simulateSpy = jest.spyOn(simulator, 'simulateSeries');

    baseProbSpy.mockReturnValue(0.55);
    adjustedProbSpy.mockReturnValue(0.55);
    simulateSpy.mockReturnValue({
      winsA: 2,
      winsB: 0,
      mapDetails: [],
      stats: {},
    });

    const result = strategy.execute(buildContext(), 1);

    expect(result.algorithmType).toBe('DOUBLE_ELIMINATION');
    expect(result.bracket[0]).toMatchObject({
      id: 'm1',
      scoreA: 2,
      scoreB: 0,
      details: { maps: [] },
      stats: {},
    });
    expect(baseProbSpy).toHaveBeenCalledWith(1500, 1400);
    expect(adjustedProbSpy).toHaveBeenCalledWith(0.55, 'team-a', 'team-b', []);
    expect(simulateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'team-a' }),
      expect.objectContaining({ id: 'team-b' }),
      0.55,
      3,
      expect.any(Function),
    );
    expect(randomSpy).toHaveBeenCalled();
  });
});
