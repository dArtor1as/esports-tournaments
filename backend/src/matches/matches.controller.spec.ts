import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { MatchesController } from './matches.controller';
import { MatchesProgressionService } from './matches-progression.service';
import { MatchesGeneratorService } from './matches-generator.service';
import { MatchesConsensusService } from './matches-consensus.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import { ReportScoreDto, DisputeMatchDto } from './dto/consensus.dto';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

describe('MatchesController', () => {
  let controller: MatchesController;
  let generatorService: MockProxy<MatchesGeneratorService>;
  let consensusService: MockProxy<MatchesConsensusService>;
  let progressionService: MockProxy<MatchesProgressionService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    generatorService = mock<MatchesGeneratorService>();
    consensusService = mock<MatchesConsensusService>();
    progressionService = mock<MatchesProgressionService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: MatchesProgressionService, useValue: progressionService },
        { provide: MatchesConsensusService, useValue: consensusService },
        { provide: MatchesGeneratorService, useValue: generatorService },
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('generateBracket delegates to service', async () => {
    const dto: GenerateBracketDto = { tournamentId: 't1', teamCount: 8 };
    const genSpy = jest.spyOn(generatorService, 'generateBracket');

    generatorService.generateBracket.mockResolvedValueOnce([
      { id: 'm1' },
    ] as never);

    await expect(controller.generateBracket(dto, user)).resolves.toEqual([
      { id: 'm1' },
    ]);
    expect(genSpy).toHaveBeenCalledWith(dto, user);
  });

  it('generateGroups delegates to service', async () => {
    const dto: GenerateBracketDto = { tournamentId: 't1', groupCount: 4 };
    const genSpy = jest.spyOn(generatorService, 'generateGroupStage');

    generatorService.generateGroupStage.mockResolvedValueOnce([
      { id: 'g1' },
    ] as never);

    await expect(controller.generateGroups(dto, user)).resolves.toEqual([
      { id: 'g1' },
    ]);
    expect(genSpy).toHaveBeenCalledWith(dto, user);
  });

  it('transitionToPlayoffs delegates to service', async () => {
    const dto: GenerateBracketDto = { tournamentId: 't1' };
    const transitionSpy = jest.spyOn(
      progressionService,
      'transitionToPlayoffs',
    );

    progressionService.transitionToPlayoffs.mockResolvedValueOnce({
      message: 'ok',
      playoffTeams: [],
    } as never);

    await expect(controller.transitionToPlayoffs(dto, user)).resolves.toEqual({
      message: 'ok',
      playoffTeams: [],
    });
    expect(transitionSpy).toHaveBeenCalledWith('t1', user);
  });

  it('forfeitMatch delegates to service', async () => {
    const dto: ForfeitMatchDto = { forfeitingTeamId: 'team-a' };
    const forfeitSpy = jest.spyOn(consensusService, 'forfeitMatch');

    consensusService.forfeitMatch.mockResolvedValueOnce({
      message: 'ok',
    } as never);

    await expect(controller.forfeitMatch('m1', dto, user)).resolves.toEqual({
      message: 'ok',
    });
    expect(forfeitSpy).toHaveBeenCalledWith('m1', dto, user);
  });

  it('reportMatch delegates to service', async () => {
    const dto: ReportScoreDto = { scoreA: 2, scoreB: 1 };
    const reportSpy = jest.spyOn(consensusService, 'reportMatch');

    consensusService.reportMatch.mockResolvedValueOnce({ id: 'm1' } as never);

    await expect(controller.reportMatch('m1', dto, user)).resolves.toEqual({
      id: 'm1',
    });
    expect(reportSpy).toHaveBeenCalledWith('m1', dto, user);
  });

  it('confirmMatch delegates to service', async () => {
    const confirmSpy = jest.spyOn(consensusService, 'confirmMatch');

    consensusService.confirmMatch.mockResolvedValueOnce({
      message: 'ok',
    } as never);

    await expect(controller.confirmMatch('m1', user)).resolves.toEqual({
      message: 'ok',
    });
    expect(confirmSpy).toHaveBeenCalledWith('m1', user);
  });

  it('disputeMatch delegates to service', async () => {
    const dto: DisputeMatchDto = { reason: 'reason' };
    const disputeSpy = jest.spyOn(consensusService, 'disputeMatch');

    consensusService.disputeMatch.mockResolvedValueOnce({ id: 'm1' } as never);

    await expect(controller.disputeMatch('m1', dto, user)).resolves.toEqual({
      id: 'm1',
    });
    expect(disputeSpy).toHaveBeenCalledWith('m1', dto, user);
  });

  it('forceResolveMatch delegates to service', async () => {
    const dto: ReportScoreDto = { scoreA: 2, scoreB: 1 };
    const forceSpy = jest.spyOn(consensusService, 'forceResolveMatch');

    consensusService.forceResolveMatch.mockResolvedValueOnce({
      message: 'ok',
    } as never);

    await expect(
      controller.forceResolveMatch('m1', dto, user),
    ).resolves.toEqual({
      message: 'ok',
    });
    expect(forceSpy).toHaveBeenCalledWith('m1', dto, user);
  });
});
