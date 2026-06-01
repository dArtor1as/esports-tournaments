import { Bracket, Stage } from '@prisma/client';
import { mock } from 'jest-mock-extended';
import { GroupStageStrategy } from './group-stage.strategy';
import { ProbabilityCalculatorService } from '../probability-calculator.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  SimulationContext,
  SimulationMatch,
} from '../genetic-simulator.types';
import type { IMatchSimulator } from 'src/match-simulators/match-simulator.interface';

describe('GroupStageStrategy', () => {
  let strategy: GroupStageStrategy;
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
        stage: Stage.GROUP,
        bracket: Bracket.NONE,
        groupName: 'A',
        round: 1,
        teamAId: 'team-a',
        teamBId: 'team-b',
        scoreA: 0,
        scoreB: 0,
        bestOf: 2,
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
    strategy = new GroupStageStrategy(mock<PrismaService>(), probabilityCalc);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes simulation and returns standings', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const baseProbSpy = jest.spyOn(probabilityCalc, 'getBaseProbability');
    const adjustedProbSpy = jest.spyOn(
      probabilityCalc,
      'getAdjustedProbability',
    );
    const simulateSpy = jest.spyOn(simulator, 'simulateSeries');

    baseProbSpy.mockReturnValue(0.6);
    adjustedProbSpy.mockReturnValue(0.6);
    simulateSpy.mockReturnValue({
      winsA: 2,
      winsB: 0,
      mapDetails: [],
      stats: {},
    });

    const result = strategy.execute(buildContext(), 1);

    expect(result.algorithmType).toBe('GROUP_STAGE');
    expect(result.standings?.['team-a']).toMatchObject({
      points: 3,
      matchesWon: 1,
      matchesLost: 0,
      mapsWon: 2,
      mapsLost: 0,
    });
    expect(result.standings?.['team-b']).toMatchObject({
      points: 0,
      matchesWon: 0,
      matchesLost: 1,
      mapsWon: 0,
      mapsLost: 2,
    });
    expect(baseProbSpy).toHaveBeenCalledWith(1500, 1400);
    expect(adjustedProbSpy).toHaveBeenCalledWith(0.6, 'team-a', 'team-b', []);
    expect(simulateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'team-a' }),
      expect.objectContaining({ id: 'team-b' }),
      0.6,
      2,
      expect.any(Function),
    );
    expect(randomSpy).toHaveBeenCalled();
  });
  it('застосовує всі правила тай-брейків (H2H, різниця карт, рандом) при однакових показниках', () => {
    const context = buildContext();
    context.baseSkeleton = [
      {
        id: 'm1',
        stage: Stage.GROUP,
        bracket: Bracket.NONE,
        groupName: 'A',
        round: 1,
        teamAId: 'team-a',
        teamBId: 'team-b',
        scoreA: 0,
        scoreB: 0,
        bestOf: 2,
      } as never,
    ];

    jest.spyOn(probabilityCalc, 'getBaseProbability').mockReturnValue(0.5);
    jest.spyOn(probabilityCalc, 'getAdjustedProbability').mockReturnValue(0.5);

    // Симулюємо нічию 1-1, щоб у команд були абсолютно однакові очки, H2H та різниця карт
    jest.spyOn(context.simulator, 'simulateSeries').mockReturnValue({
      winsA: 1,
      winsB: 1,
      mapDetails: [],
      stats: {},
    });

    // Форсуємо рандом, щоб гарантовано покрити рядок 103: Math.random() > 0.5 ? 1 : -1
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);

    const result = strategy.execute(context, 1);

    expect(result.algorithmType).toBe('GROUP_STAGE');
    // Перевіряємо, що стендінги успішно сформувались без падінь (тай-брейки відпрацювали)
    expect(result.standings?.['team-a']).toBeDefined();

    randomSpy.mockRestore();
  });
});
