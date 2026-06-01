import { Test, TestingModule } from '@nestjs/testing';
import { Bracket, Stage } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { GeneticSimulatorPersistence } from './genetic-simulator.persistence';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ContextParticipant,
  StrategyResult,
} from './genetic-simulator.types';

jest.mock('src/prisma/prisma.utils', () => ({
  toPrismaJson: (value: unknown) => value,
}));

describe('GeneticSimulatorPersistence', () => {
  let service: GeneticSimulatorPersistence;
  let prisma: DeepMockProxy<PrismaService>;

  const bracket = [
    {
      id: 'm1',
      stage: Stage.PLAYOFF,
      bracket: Bracket.UPPER,
      groupName: null,
      round: 1,
      teamAId: 'team-a',
      teamBId: 'team-b',
      scoreA: 2,
      scoreB: 1,
      bestOf: 3,
      nextMatchWinnerId: null,
      nextMatchLoserId: null,
      details: { map: 'nuke' },
      stats: { kills: 10 },
    },
  ];

  const baseResult: StrategyResult = {
    algorithmType: 'SINGLE_ELIMINATION',
    bestFitnessScore: 1,
    bracket,
    executionTimeMs: 10,
    generations: 2,
    standings: {
      'team-a': {
        points: 3,
        matchesWon: 1,
        matchesLost: 0,
        mapsWon: 2,
        mapsLost: 1,
        h2h: {},
      },
    },
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneticSimulatorPersistence,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GeneticSimulatorPersistence>(
      GeneticSimulatorPersistence,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves dry run with predicted data', async () => {
    const createSpy = jest.spyOn(prisma.simulationRun, 'create');

    await service.saveDryRun('t1', 10, baseResult);

    const [createArgs] = createSpy.mock.calls[0];

    expect(createArgs.data).toMatchObject({
      tournamentId: 't1',
      algorithmType: baseResult.algorithmType,
      populations: 10,
      generations: baseResult.generations,
      fitnessScore: baseResult.bestFitnessScore,
      executionTimeMs: baseResult.executionTimeMs,
      isDryRun: true,
      predictedData: {
        bracket: baseResult.bracket,
        standings: baseResult.standings,
      },
    });
  });

  it('commits playoff results and starts transaction', async () => {
    const updateSpy = jest.spyOn(prisma.match, 'update');
    const tournamentSpy = jest.spyOn(prisma.tournament, 'update');
    const runSpy = jest.spyOn(prisma.simulationRun, 'create');
    const transactionSpy = jest.spyOn(prisma, '$transaction');

    await service.commitPlayoffResults('t1', 12, baseResult);

    const [updateArgs] = updateSpy.mock.calls[0];

    expect(updateArgs).toMatchObject({
      where: { id: 'm1' },
      data: {
        teamAId: 'team-a',
        teamBId: 'team-b',
        scoreA: 2,
        scoreB: 1,
        details: { map: 'nuke' },
        stats: { kills: 10 },
        isProcessed: true,
      },
    });
    expect(tournamentSpy).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'finished' },
    });
    const [runArgs] = runSpy.mock.calls[0];

    expect(runArgs.data).toMatchObject({
      tournamentId: 't1',
      algorithmType: baseResult.algorithmType,
      populations: 12,
      isDryRun: false,
    });
    expect(transactionSpy).toHaveBeenCalledWith(expect.any(Array));
  });

  it('commits group results with participant stats', async () => {
    const participants: ContextParticipant[] = [
      { id: 'p1', teamId: 'team-a' },
      { id: 'p2', teamId: 'team-b' },
    ];
    const updateSpy = jest.spyOn(prisma.match, 'update');
    const participantSpy = jest.spyOn(prisma.tournamentParticipant, 'update');

    await service.commitGroupResults('t1', 5, participants, baseResult);

    expect(updateSpy).toHaveBeenCalled();
    expect(participantSpy).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        groupPoints: 3,
        matchesWon: 1,
        matchesLost: 0,
        mapsWon: 2,
        mapsLost: 1,
      },
    });
    expect(participantSpy).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: {
        groupPoints: 0,
        matchesWon: 0,
        matchesLost: 0,
        mapsWon: 0,
        mapsLost: 0,
      },
    });
  });
});
