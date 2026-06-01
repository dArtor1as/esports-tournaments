import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Role, Stage } from '@prisma/client';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import type { Cache } from 'cache-manager';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { SimulationContextBuilder } from './simulation-context.builder';
import { AccessPolicyService } from '../auth/access-policy.service';
import { SingleEliminationStrategy } from './strategies/single-elimination.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { GeneticSimulatorPersistence } from './genetic-simulator.persistence';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type {
  SimulationContext,
  StrategyResult,
} from './genetic-simulator.types';
import type {
  IMatchSimulator,
  TeamInput,
} from '../match-simulators/match-simulator.interface';

jest.mock('../stats/stats.service', () => ({
  StatsService: class {},
}));
jest.mock(
  'common/helpers/tier.helper',
  () => ({
    TierHelper: {},
  }),
  { virtual: true },
);

describe('GeneticSimulatorService', () => {
  let service: GeneticSimulatorService;
  let prisma: DeepMockProxy<PrismaService>;
  let statsService: MockProxy<StatsService>;
  let simulationContextBuilder: MockProxy<SimulationContextBuilder>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let singleEliminationStrategy: MockProxy<SingleEliminationStrategy>;
  let groupStageStrategy: MockProxy<GroupStageStrategy>;
  let doubleEliminationStrategy: MockProxy<DoubleEliminationStrategy>;
  let persistence: MockProxy<GeneticSimulatorPersistence>;
  let cacheManager: MockProxy<Cache>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  const baseResult: StrategyResult = {
    algorithmType: 'SINGLE_ELIMINATION',
    bestFitnessScore: 1,
    bracket: [],
    executionTimeMs: 5,
    generations: 3,
  };

  const createContext = (
    stage: Stage,
    bracketType?: string,
    baseSkeletonBracket: 'LOWER' | 'UPPER' = 'UPPER',
  ): SimulationContext => ({
    tournament: {
      id: 't1',
      creatorId: 'u1',
      settings: bracketType ? { bracketType } : {},
      participants: [{ id: 'p1', teamId: 'team1' }],
    },
    simulator: mock<IMatchSimulator>(),
    pastMatches: [],
    teamRatings: { team1: 1000 },
    teamsData: {
      team1: {
        id: 'team1',
        rating: 1000,
        players: [],
      } as TeamInput,
    },
    baseSkeleton: [
      {
        id: 'm1',
        stage,
        bracket: baseSkeletonBracket,
        groupName: null,
        round: 1,
        teamAId: null,
        teamBId: null,
        scoreA: 0,
        scoreB: 0,
        bestOf: 1,
        nextMatchWinnerId: null,
        nextMatchLoserId: null,
      },
    ],
    estimatedGenesNeeded: 1,
    matchCount: 1,
  });

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    statsService = mock<StatsService>();
    simulationContextBuilder = mock<SimulationContextBuilder>();
    accessPolicy = mock<AccessPolicyService>();
    singleEliminationStrategy = mock<SingleEliminationStrategy>();
    groupStageStrategy = mock<GroupStageStrategy>();
    doubleEliminationStrategy = mock<DoubleEliminationStrategy>();
    persistence = mock<GeneticSimulatorPersistence>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneticSimulatorService,
        { provide: PrismaService, useValue: prisma },
        { provide: StatsService, useValue: statsService },
        {
          provide: SimulationContextBuilder,
          useValue: simulationContextBuilder,
        },
        { provide: AccessPolicyService, useValue: accessPolicy },
        {
          provide: SingleEliminationStrategy,
          useValue: singleEliminationStrategy,
        },
        { provide: GroupStageStrategy, useValue: groupStageStrategy },
        {
          provide: DoubleEliminationStrategy,
          useValue: doubleEliminationStrategy,
        },
        { provide: GeneticSimulatorPersistence, useValue: persistence },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<GeneticSimulatorService>(GeneticSimulatorService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runSimulation', () => {
    it('runs single elimination and saves dry run by default', async () => {
      const dto: SimulateTournamentDto = {
        tournamentId: 't1',
        populations: 10,
      };
      const context = createContext(Stage.PLAYOFF);
      const prepareSpy = jest.spyOn(
        simulationContextBuilder,
        'prepareSimulationContext',
      );
      const executeSpy = jest.spyOn(singleEliminationStrategy, 'execute');
      const saveDryRunSpy = jest.spyOn(persistence, 'saveDryRun');
      const commitSpy = jest.spyOn(persistence, 'commitPlayoffResults');

      prepareSpy.mockResolvedValueOnce(context);
      executeSpy.mockReturnValueOnce(baseResult);

      await expect(service.runSimulation(dto, user)).resolves.toEqual({
        algorithmType: baseResult.algorithmType,
        bestFitnessScore: baseResult.bestFitnessScore,
        bracket: baseResult.bracket,
        statsMessage: 'Аналітичний прогноз збережено. Стан турніру не змінено.',
      });

      expect(prepareSpy).toHaveBeenCalledWith('t1', Stage.PLAYOFF, user);
      expect(executeSpy).toHaveBeenCalledWith(context, dto.populations);
      expect(saveDryRunSpy).toHaveBeenCalledWith(
        't1',
        dto.populations,
        baseResult,
      );
      expect(commitSpy).not.toHaveBeenCalled();
    });

    it('runs double elimination when lower bracket exists', async () => {
      const dto: SimulateTournamentDto = {
        tournamentId: 't1',
        populations: 8,
        isDryRun: true,
      };
      const context = createContext(Stage.PLAYOFF, undefined, 'LOWER');
      const prepareSpy = jest.spyOn(
        simulationContextBuilder,
        'prepareSimulationContext',
      );
      const doubleSpy = jest.spyOn(doubleEliminationStrategy, 'execute');
      const singleSpy = jest.spyOn(singleEliminationStrategy, 'execute');
      const saveDryRunSpy = jest.spyOn(persistence, 'saveDryRun');

      prepareSpy.mockResolvedValueOnce(context);
      doubleSpy.mockReturnValueOnce({
        ...baseResult,
        algorithmType: 'DOUBLE_ELIMINATION',
      });

      await expect(service.runSimulation(dto, user)).resolves.toMatchObject({
        algorithmType: 'DOUBLE_ELIMINATION',
      });

      expect(doubleSpy).toHaveBeenCalledWith(context, dto.populations);
      expect(singleSpy).not.toHaveBeenCalled();
      expect(saveDryRunSpy).toHaveBeenCalled();
    });

    it('commits results and clears caches on non-dry run', async () => {
      const dto: SimulateTournamentDto = {
        tournamentId: 't1',
        populations: 5,
        isDryRun: false,
      };
      const context = createContext(Stage.PLAYOFF);
      const prepareSpy = jest.spyOn(
        simulationContextBuilder,
        'prepareSimulationContext',
      );
      const executeSpy = jest.spyOn(singleEliminationStrategy, 'execute');
      const accessSpy = jest.spyOn(
        accessPolicy,
        'checkTournamentCreatorOrAdmin',
      );
      const cacheDelSpy = jest.spyOn(cacheManager, 'del');
      const findFirstSpy = jest.spyOn(prisma.match, 'findFirst');
      const commitSpy = jest.spyOn(persistence, 'commitPlayoffResults');
      const statsSpy = jest.spyOn(statsService, 'processTournamentStats');

      prepareSpy.mockResolvedValueOnce(context);
      executeSpy.mockReturnValueOnce(baseResult);
      findFirstSpy.mockResolvedValueOnce(null);

      await expect(service.runSimulation(dto, user)).resolves.toMatchObject({
        algorithmType: baseResult.algorithmType,
      });

      expect(accessSpy).toHaveBeenCalledWith('u1', user);
      expect(cacheDelSpy).toHaveBeenCalledWith('/matches/tournament/t1');
      expect(cacheDelSpy).toHaveBeenCalledWith('/tournaments/t1');
      expect(cacheDelSpy).toHaveBeenCalledWith(
        '/tournaments/workflow?workflow=generation',
      );
      expect(cacheDelSpy).toHaveBeenCalledWith(
        '/tournaments/workflow?workflow=simulation',
      );
      expect(findFirstSpy).toHaveBeenCalledWith({
        where: { tournamentId: 't1', stage: Stage.PLAYOFF, isProcessed: true },
      });
      expect(commitSpy).toHaveBeenCalledWith('t1', dto.populations, baseResult);
      expect(statsSpy).toHaveBeenCalledWith('t1', user);
    });

    it('throws when manual matches exist on non-dry run', async () => {
      const dto: SimulateTournamentDto = {
        tournamentId: 't1',
        populations: 5,
        isDryRun: false,
      };
      const context = createContext(Stage.PLAYOFF);
      const prepareSpy = jest.spyOn(
        simulationContextBuilder,
        'prepareSimulationContext',
      );
      const findFirstSpy = jest.spyOn(prisma.match, 'findFirst');

      prepareSpy.mockResolvedValueOnce(context);
      findFirstSpy.mockResolvedValueOnce({ id: 'm1' } as never);

      await expect(service.runSimulation(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('runGroupSimulation', () => {
    it('runs group strategy and saves dry run', async () => {
      const dto: SimulateTournamentDto = {
        tournamentId: 't1',
        stage: Stage.GROUP,
        populations: 6,
        isDryRun: true,
      };
      const context = createContext(Stage.GROUP);
      const prepareSpy = jest.spyOn(
        simulationContextBuilder,
        'prepareSimulationContext',
      );
      const executeSpy = jest.spyOn(groupStageStrategy, 'execute');
      const saveDryRunSpy = jest.spyOn(persistence, 'saveDryRun');

      prepareSpy.mockResolvedValueOnce(context);
      executeSpy.mockReturnValueOnce({
        ...baseResult,
        algorithmType: 'GROUP_STAGE',
        standings: {},
      });

      await expect(
        service.runGroupSimulation(dto, user),
      ).resolves.toMatchObject({
        algorithmType: 'GROUP_STAGE',
      });

      expect(executeSpy).toHaveBeenCalledWith(context, dto.populations);
      expect(saveDryRunSpy).toHaveBeenCalledWith(
        't1',
        dto.populations,
        expect.objectContaining({ algorithmType: 'GROUP_STAGE' }),
      );
    });

    it('commits group results on non-dry run', async () => {
      const dto: SimulateTournamentDto = {
        tournamentId: 't1',
        stage: Stage.GROUP,
        populations: 4,
        isDryRun: false,
      };
      const context = createContext(Stage.GROUP);
      const prepareSpy = jest.spyOn(
        simulationContextBuilder,
        'prepareSimulationContext',
      );
      const executeSpy = jest.spyOn(groupStageStrategy, 'execute');
      const commitSpy = jest.spyOn(persistence, 'commitGroupResults');
      const statsSpy = jest.spyOn(statsService, 'processTournamentStats');
      const findFirstSpy = jest.spyOn(prisma.match, 'findFirst');

      prepareSpy.mockResolvedValueOnce(context);
      executeSpy.mockReturnValueOnce({
        ...baseResult,
        algorithmType: 'GROUP_STAGE',
        standings: {},
      });
      findFirstSpy.mockResolvedValueOnce(null);

      await expect(
        service.runGroupSimulation(dto, user),
      ).resolves.toMatchObject({
        algorithmType: 'GROUP_STAGE',
      });

      expect(commitSpy).toHaveBeenCalledWith(
        't1',
        dto.populations,
        context.tournament.participants,
        expect.objectContaining({ algorithmType: 'GROUP_STAGE' }),
      );
      expect(statsSpy).toHaveBeenCalledWith('t1', user);
    });
  });

  describe('findRunsByTournament', () => {
    it('throws when tournament not found', async () => {
      const findUniqueSpy = jest.spyOn(prisma.tournament, 'findUnique');
      findUniqueSpy.mockResolvedValueOnce(null);

      await expect(service.findRunsByTournament('t1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns runs and checks access', async () => {
      const findUniqueSpy = jest.spyOn(prisma.tournament, 'findUnique');
      const accessSpy = jest.spyOn(
        accessPolicy,
        'checkTournamentCreatorOrAdmin',
      );
      const findManySpy = jest.spyOn(prisma.simulationRun, 'findMany');

      findUniqueSpy.mockResolvedValueOnce({
        id: 't1',
        creatorId: 'u1',
      } as never);
      findManySpy.mockResolvedValueOnce([{ id: 'r1' }] as never);

      await expect(service.findRunsByTournament('t1', user)).resolves.toEqual([
        { id: 'r1' },
      ]);

      expect(accessSpy).toHaveBeenCalledWith('u1', user);
      expect(findManySpy).toHaveBeenCalledWith({
        where: { tournamentId: 't1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
