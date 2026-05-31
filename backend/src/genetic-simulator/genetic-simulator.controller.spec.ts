import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { GeneticSimulatorController } from './genetic-simulator.controller';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { Role, Stage } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

jest.mock('../stats/stats.service', () => ({
  StatsService: class {},
}));
jest.mock(
  '/common/helpers/tier.helper',
  () => ({
    TierHelper: {},
  }),
  { virtual: true },
);

describe('GeneticSimulatorController', () => {
  let controller: GeneticSimulatorController;
  let geneticSimulatorService: MockProxy<GeneticSimulatorService>;

  beforeEach(async () => {
    geneticSimulatorService = mock<GeneticSimulatorService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeneticSimulatorController],
      providers: [
        {
          provide: GeneticSimulatorService,
          useValue: geneticSimulatorService,
        },
      ],
    }).compile();

    controller = module.get<GeneticSimulatorController>(
      GeneticSimulatorController,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('run delegates to service', async () => {
    const dto: SimulateTournamentDto = {
      tournamentId: 't1',
      stage: Stage.PLAYOFF,
      populations: 10,
      isDryRun: true,
    };
    const user: JwtPayload = {
      userId: 'u1',
      email: 'u1@example.com',
      role: Role.USER,
    };
    const runSpy = jest.spyOn(geneticSimulatorService, 'runSimulation');

    geneticSimulatorService.runSimulation.mockResolvedValueOnce({
      algorithmType: 'SINGLE_ELIMINATION',
      bestFitnessScore: 1,
      bracket: [],
      statsMessage: 'ok',
    } as never);

    await expect(controller.run(dto, user)).resolves.toEqual({
      algorithmType: 'SINGLE_ELIMINATION',
      bestFitnessScore: 1,
      bracket: [],
      statsMessage: 'ok',
    });
    expect(runSpy).toHaveBeenCalledWith(dto, user);
  });

  it('runGroups delegates to service', async () => {
    const dto: SimulateTournamentDto = {
      tournamentId: 't1',
      stage: Stage.GROUP,
      populations: 5,
      isDryRun: true,
    };
    const user: JwtPayload = {
      userId: 'u1',
      email: 'u1@example.com',
      role: Role.USER,
    };
    const runGroupsSpy = jest.spyOn(
      geneticSimulatorService,
      'runGroupSimulation',
    );

    geneticSimulatorService.runGroupSimulation.mockResolvedValueOnce({
      algorithmType: 'GROUP_STAGE',
      bestFitnessScore: 1,
      bracket: [],
      standings: {},
      statsMessage: 'ok',
    } as never);

    await expect(controller.runGroups(dto, user)).resolves.toEqual({
      algorithmType: 'GROUP_STAGE',
      bestFitnessScore: 1,
      bracket: [],
      standings: {},
      statsMessage: 'ok',
    });
    expect(runGroupsSpy).toHaveBeenCalledWith(dto, user);
  });

  it('getTournamentRuns delegates to service', async () => {
    const user: JwtPayload = {
      userId: 'u1',
      email: 'u1@example.com',
      role: Role.USER,
    };
    const runsSpy = jest.spyOn(geneticSimulatorService, 'findRunsByTournament');

    geneticSimulatorService.findRunsByTournament.mockResolvedValueOnce([
      { id: 'r1' },
    ] as never);

    await expect(controller.getTournamentRuns('t1', user)).resolves.toEqual([
      { id: 'r1' },
    ]);
    expect(runsSpy).toHaveBeenCalledWith('t1', user);
  });
});
