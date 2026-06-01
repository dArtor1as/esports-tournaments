import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import type { Cache } from 'cache-manager';
import { MatchesGeneratorService } from './matches-generator.service';
import { PrismaService } from '../prisma/prisma.service';
import { SingleEliminationGenerator } from './generators/single-elimination.generator';
import { DoubleEliminationGenerator } from './generators/double-elimination.generator';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { MatchesGenerationLogic } from './matches-generation.logic';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('MatchesGeneratorService', () => {
  let service: MatchesGeneratorService;
  let prisma: DeepMockProxy<PrismaService>;
  let singleGen: MockProxy<SingleEliminationGenerator>;
  let doubleGen: MockProxy<DoubleEliminationGenerator>;
  let groupGen: MockProxy<GroupStageGenerator>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let generationLogic: MockProxy<MatchesGenerationLogic>;
  let cacheManager: MockProxy<Cache>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    singleGen = mock<SingleEliminationGenerator>();
    doubleGen = mock<DoubleEliminationGenerator>();
    groupGen = mock<GroupStageGenerator>();
    accessPolicy = mock<AccessPolicyService>();
    generationLogic = mock<MatchesGenerationLogic>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesGeneratorService,
        { provide: PrismaService, useValue: prisma },
        { provide: SingleEliminationGenerator, useValue: singleGen },
        { provide: DoubleEliminationGenerator, useValue: doubleGen },
        { provide: GroupStageGenerator, useValue: groupGen },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: MatchesGenerationLogic, useValue: generationLogic },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<MatchesGeneratorService>(MatchesGeneratorService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when tournament is not found', async () => {
    prisma.tournament.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.generateBracket({ tournamentId: 't1' }, user),
    ).rejects.toThrow(new NotFoundException('Турнір не знайдено'));
  });

  it('delegates to double elimination generator', async () => {
    const dto: GenerateBracketDto = { tournamentId: 't1', teamCount: 8 };
    const participants = [
      { teamId: 'team-a', team: { id: 'team-a' } },
      { teamId: 'team-b', team: { id: 'team-b' } },
    ];
    const parseSpy = jest.spyOn(generationLogic, 'parseSettings');
    const validateSpy = jest.spyOn(
      generationLogic,
      'validatePlayoffGeneration',
    );
    const cacheSpy = jest.spyOn(cacheManager, 'del');
    const accessSpy = jest.spyOn(accessPolicy, 'checkTournamentCreatorOrAdmin');
    const doubleGenSpy = jest.spyOn(doubleGen, 'generate');

    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'planned',
      format: 'TEAM',
      creatorId: 'u1',
      settings: { bracketType: 'DOUBLE_ELIMINATION' },
    } as never);
    prisma.match.count.mockResolvedValueOnce(0);
    prisma.tournamentParticipant.findMany.mockResolvedValueOnce(
      participants as never,
    );
    parseSpy.mockReturnValueOnce({ bracketType: 'DOUBLE_ELIMINATION' });
    validateSpy.mockReturnValueOnce(2);
    doubleGen.generate.mockResolvedValueOnce([{ id: 'm1' }] as never);

    await expect(service.generateBracket(dto, user)).resolves.toEqual([
      { id: 'm1' },
    ]);

    expect(accessSpy).toHaveBeenCalledWith('u1', user);
    expect(parseSpy).toHaveBeenCalled();
    expect(validateSpy).toHaveBeenCalledWith('planned', 0, 8, 2);
    expect(cacheSpy).toHaveBeenCalledTimes(4);
    expect(doubleGenSpy).toHaveBeenCalledWith('t1', 2, participants, 'TEAM');
  });

  it('delegates to single elimination generator', async () => {
    const dto: GenerateBracketDto = { tournamentId: 't1', teamCount: 4 };
    const singleGenSpy = jest.spyOn(singleGen, 'generate');

    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'planned',
      format: 'TEAM',
      creatorId: 'u1',
      settings: {},
    } as never);
    prisma.match.count.mockResolvedValueOnce(0);
    prisma.tournamentParticipant.findMany.mockResolvedValueOnce([
      { teamId: 'team-a', team: { id: 'team-a' } },
      { teamId: 'team-b', team: { id: 'team-b' } },
    ] as never);
    generationLogic.parseSettings.mockReturnValueOnce({});
    generationLogic.validatePlayoffGeneration.mockReturnValueOnce(2);
    singleGen.generate.mockResolvedValueOnce([{ id: 'm2' }] as never);

    await expect(service.generateBracket(dto, user)).resolves.toEqual([
      { id: 'm2' },
    ]);

    expect(singleGenSpy).toHaveBeenCalledWith(
      't1',
      2,
      expect.any(Array),
      'TEAM',
    );
  });

  it('delegates group generation with effective group count', async () => {
    const dto: GenerateBracketDto = { tournamentId: 't1', groupCount: 4 };
    const parseSpy = jest.spyOn(generationLogic, 'parseSettings');
    const validateSpy = jest.spyOn(generationLogic, 'validateGroupGeneration');
    const groupGenSpy = jest.spyOn(groupGen, 'generate');

    prisma.tournament.findUnique.mockResolvedValueOnce({
      id: 't1',
      status: 'planned',
      format: 'TEAM',
      creatorId: 'u1',
      settings: { groupCount: 4 },
    } as never);
    prisma.match.count.mockResolvedValueOnce(0);
    prisma.tournamentParticipant.findMany.mockResolvedValueOnce([
      { teamId: 'team-a', team: { id: 'team-a' } },
      { teamId: 'team-b', team: { id: 'team-b' } },
      { teamId: 'team-c', team: { id: 'team-c' } },
      { teamId: 'team-d', team: { id: 'team-d' } },
    ] as never);
    parseSpy.mockReturnValueOnce({ groupCount: 4 });
    validateSpy.mockReturnValueOnce({ teamCount: 4, effectiveGroupCount: 2 });
    groupGen.generate.mockResolvedValueOnce([{ id: 'g1' }] as never);

    await expect(service.generateGroupStage(dto, user)).resolves.toEqual([
      { id: 'g1' },
    ]);

    expect(validateSpy).toHaveBeenCalledWith('planned', 0, undefined, 4, 4, 4);
    expect(groupGenSpy).toHaveBeenCalledWith(
      't1',
      4,
      expect.any(Array),
      'TEAM',
      2,
    );
  });
});
