import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Bracket, Match, MatchStatus, Role, Stage } from '@prisma/client';
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended';
import { SimulationContextBuilder } from './simulation-context.builder';
import { PrismaService } from '../prisma/prisma.service';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { IMatchSimulator } from 'src/match-simulators/match-simulator.interface';

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

describe('SimulationContextBuilder', () => {
  let builder: SimulationContextBuilder;
  let prisma: DeepMockProxy<PrismaService>;
  let simulatorFactory: MockProxy<SimulatorFactoryService>;
  let accessPolicy: MockProxy<AccessPolicyService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    simulatorFactory = mock<SimulatorFactoryService>();
    accessPolicy = mock<AccessPolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulationContextBuilder,
        { provide: PrismaService, useValue: prisma },
        { provide: SimulatorFactoryService, useValue: simulatorFactory },
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    builder = module.get<SimulationContextBuilder>(SimulationContextBuilder);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when tournament is not live', async () => {
    const findUniqueSpy = jest.spyOn(prisma.tournament, 'findUnique');

    findUniqueSpy.mockResolvedValueOnce({
      id: 't1',
      status: 'planned',
      creatorId: 'u1',
    } as never);

    await expect(
      builder.prepareSimulationContext('t1', Stage.PLAYOFF, user),
    ).rejects.toThrow(BadRequestException);
  });

  it('builds context with roster fallback and playoff ordering', async () => {
    const simulator = mock<IMatchSimulator>();
    const findUniqueSpy = jest.spyOn(prisma.tournament, 'findUnique');
    const getSimulatorSpy = jest.spyOn(simulatorFactory, 'getSimulator');
    const accessSpy = jest.spyOn(accessPolicy, 'checkTournamentCreatorOrAdmin');
    const findManySpy = jest.spyOn(prisma.match, 'findMany');

    findUniqueSpy.mockResolvedValueOnce({
      id: 't1',
      status: 'live',
      creatorId: 'u1',
      settings: {},
      game: { slug: 'cs2' },
      participants: [
        {
          id: 'p1',
          teamId: 'team1',
          team: {
            averageRating: 1500,
            players: [
              {
                id: 'tp1',
                rating: 1000,
                teamRole: 'PLAYER',
                inGameRole: 'rifler',
              },
              {
                id: 'tp2',
                rating: 900,
                teamRole: 'COACH',
                inGameRole: null,
              },
            ],
          },
          tournamentRosters: [
            {
              role: 'PLAYER',
              player: {
                id: 'r1',
                rating: 1100,
                inGameRole: 'awp',
              },
            },
            {
              role: 'COACH',
              player: {
                id: 'r2',
                rating: 800,
                inGameRole: null,
              },
            },
          ],
        },
        {
          id: 'p2',
          teamId: 'team2',
          team: {
            averageRating: 1400,
            players: [
              {
                id: 'tp3',
                rating: 950,
                teamRole: 'CAPTAIN',
                inGameRole: null,
              },
              {
                id: 'tp4',
                rating: 900,
                teamRole: 'SUB',
                inGameRole: 'support',
              },
            ],
          },
          tournamentRosters: [],
        },
      ],
    } as never);

    getSimulatorSpy.mockReturnValueOnce(simulator);
    findManySpy.mockResolvedValueOnce([]).mockResolvedValueOnce([
      buildMatch({ id: 'm-upper', bracket: Bracket.UPPER, round: 1 }),
      buildMatch({ id: 'm-lower', bracket: Bracket.LOWER, round: 1 }),
      buildMatch({
        id: 'm-final',
        bracket: Bracket.GRAND_FINAL,
        round: 1,
      }),
    ]);

    const context = await builder.prepareSimulationContext(
      't1',
      Stage.PLAYOFF,
      user,
    );

    expect(accessSpy).toHaveBeenCalledWith('u1', user);
    expect(getSimulatorSpy).toHaveBeenCalledWith('cs2');
    expect(context.teamRatings).toEqual({
      team1: 1500,
      team2: 1400,
    });
    expect(context.teamsData.team1.players).toEqual([
      { id: 'r1', rating: 1100, inGameRole: 'awp' },
    ]);
    expect(context.teamsData.team2.players).toEqual([
      { id: 'tp3', rating: 950, inGameRole: undefined },
    ]);
    expect(context.baseSkeleton.map((match) => match.id)).toEqual([
      'm-upper',
      'm-lower',
      'm-final',
    ]);
  });

  it('throws when matches for stage are empty', async () => {
    const findUniqueSpy = jest.spyOn(prisma.tournament, 'findUnique');
    const findManySpy = jest.spyOn(prisma.match, 'findMany');

    findUniqueSpy.mockResolvedValueOnce({
      id: 't1',
      status: 'live',
      creatorId: 'u1',
      settings: {},
      game: { slug: 'cs2' },
      participants: [],
    } as never);
    findManySpy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(
      builder.prepareSimulationContext('t1', Stage.GROUP, user),
    ).rejects.toThrow(BadRequestException);
  });
});
