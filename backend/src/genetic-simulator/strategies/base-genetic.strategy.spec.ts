import { Bracket, Stage } from '@prisma/client';
import { mock } from 'jest-mock-extended';
import { BaseGeneticStrategy } from './base-genetic.strategy';
import type {
  BaseIndividual,
  SimulationContext,
  SimulationMatch,
  StrategyResult,
} from '../genetic-simulator.types';
import type { IMatchSimulator } from 'src/match-simulators/match-simulator.interface';
import { ProbabilityCalculatorService } from '../probability-calculator.service';

class TestStrategy extends BaseGeneticStrategy {
  protected readonly generations = 1;
  protected readonly mutationRate = 0;

  execute(): StrategyResult {
    throw new Error('not used');
  }

  runEvolvePopulation<T extends BaseIndividual>(
    populations: number,
    estimatedGenesNeeded: number,
    evaluatorFunc: (genes: number[]) => T,
  ) {
    return this.evolvePopulation(
      populations,
      estimatedGenesNeeded,
      evaluatorFunc,
    );
  }

  runProcessMatch(
    match: SimulationMatch,
    simulationContext: SimulationContext,
    getGeneRoll: () => number,
  ) {
    return this.processMatchSimulation(match, simulationContext, getGeneRoll);
  }

  runEvaluatePlayoffIndividual(
    genes: number[],
    simulationContext: SimulationContext,
  ) {
    return this.evaluatePlayoffIndividual(genes, simulationContext);
  }
}

describe('BaseGeneticStrategy', () => {
  let strategy: TestStrategy;
  let probabilityCalc: ProbabilityCalculatorService;
  let simulator: IMatchSimulator;

  const buildContext = (): SimulationContext => ({
    tournament: { id: 't1', settings: {}, participants: [] },
    simulator,
    pastMatches: [],
    teamRatings: { 'team-a': 1600, 'team-b': 1400 },
    teamsData: {
      'team-a': { id: 'team-a', rating: 1600, players: [] },
      'team-b': { id: 'team-b', rating: 1400, players: [] },
    },
    baseSkeleton: [],
    estimatedGenesNeeded: 1,
    matchCount: 1,
  });

  beforeEach(() => {
    probabilityCalc = mock<ProbabilityCalculatorService>();
    simulator = mock<IMatchSimulator>();
    strategy = new TestStrategy(probabilityCalc);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('evolvePopulation returns fittest individual', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.4);

    const result = strategy.runEvolvePopulation(1, 1, (genes) => ({
      genes,
      fitness: genes[0] * 10,
      bracket: [],
    }));

    expect(result.fitness).toBe(4);
    expect(result.genes).toEqual([0.4]);
    expect(randomSpy).toHaveBeenCalled();
  });

  it('processMatchSimulation updates match and returns outcome info', () => {
    const context = buildContext();
    const match: SimulationMatch = {
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
    };

    const baseProbSpy = jest.spyOn(probabilityCalc, 'getBaseProbability');
    const adjustedProbSpy = jest.spyOn(
      probabilityCalc,
      'getAdjustedProbability',
    );
    const simulateSpy = jest.spyOn(simulator, 'simulateSeries');

    baseProbSpy.mockReturnValue(0.65);
    adjustedProbSpy.mockReturnValue(0.7);
    simulateSpy.mockReturnValue({
      winsA: 2,
      winsB: 1,
      mapDetails: [],
      stats: { mvp: 'team-a' },
    });

    const result = strategy.runProcessMatch(match, context, () => 0.2);

    expect(result).toMatchObject({
      matchWinnerIsA: true,
      winnerId: 'team-a',
      loserId: 'team-b',
      winnerProb: 0.7,
      winsA: 2,
      winsB: 1,
    });
    expect(match).toMatchObject({
      scoreA: 2,
      scoreB: 1,
      details: { maps: [] },
      stats: { mvp: 'team-a' },
    });
  });

  it('evaluatePlayoffIndividual advances winner to next match', () => {
    const context = buildContext();
    context.baseSkeleton = [
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
        nextMatchWinnerId: 'm2',
        nextMatchLoserId: null,
      } satisfies SimulationMatch,
      {
        id: 'm2',
        stage: Stage.PLAYOFF,
        bracket: Bracket.UPPER,
        groupName: null,
        round: 2,
        teamAId: null,
        teamBId: null,
        scoreA: 0,
        scoreB: 0,
        bestOf: 3,
        nextMatchWinnerId: null,
        nextMatchLoserId: null,
      } satisfies SimulationMatch,
    ];

    jest.spyOn(probabilityCalc, 'getBaseProbability').mockReturnValue(0.6);
    jest.spyOn(probabilityCalc, 'getAdjustedProbability').mockReturnValue(0.7);
    jest.spyOn(simulator, 'simulateSeries').mockReturnValue({
      winsA: 2,
      winsB: 0,
      mapDetails: [],
      stats: {},
    });

    const result = strategy.runEvaluatePlayoffIndividual([0.3], context);

    expect(result.fitness).toBeGreaterThan(0);
    expect(result.bracket.find((m) => m.id === 'm2')?.teamAId).toBe('team-a');
  });
});
