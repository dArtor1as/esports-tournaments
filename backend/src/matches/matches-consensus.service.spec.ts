import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import type { Cache } from 'cache-manager';
import { MatchesConsensusService } from './matches-consensus.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { MatchesProgressionService } from './matches-progression.service';
import { MailService } from 'src/mail/mail.service';
import { MatchesConsensusLogic } from './matches-consensus.logic';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import { ReportScoreDto, DisputeMatchDto } from './dto/consensus.dto';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

describe('MatchesConsensusService', () => {
  let service: MatchesConsensusService;
  let prisma: DeepMockProxy<PrismaService>;
  let statsService: MockProxy<StatsService>;
  let progressionService: MockProxy<MatchesProgressionService>;
  let mailService: MockProxy<MailService>;
  let consensusLogic: MockProxy<MatchesConsensusLogic>;
  let cacheManager: MockProxy<Cache>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    statsService = mock<StatsService>();
    progressionService = mock<MatchesProgressionService>();
    mailService = mock<MailService>();
    consensusLogic = mock<MatchesConsensusLogic>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesConsensusService,
        { provide: PrismaService, useValue: prisma },
        { provide: StatsService, useValue: statsService },
        { provide: MatchesProgressionService, useValue: progressionService },
        { provide: MailService, useValue: mailService },
        { provide: MatchesConsensusLogic, useValue: consensusLogic },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<MatchesConsensusService>(MatchesConsensusService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports match result', async () => {
    const dto: ReportScoreDto = { scoreA: 2, scoreB: 1 };
    const match = { id: 'm1', tournamentId: 't1' };
    const validateSpy = jest.spyOn(consensusLogic, 'validateReport');
    const updateSpy = jest.spyOn(prisma.match, 'update');
    const cacheSpy = jest.spyOn(cacheManager, 'del');

    prisma.match.findUnique.mockResolvedValueOnce(match as never);
    prisma.match.update.mockResolvedValueOnce({ id: 'm1' } as never);

    await expect(service.reportMatch('m1', dto, user)).resolves.toEqual({
      id: 'm1',
    });

    expect(validateSpy).toHaveBeenCalledWith(match, user);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        reportedScoreA: 2,
        reportedScoreB: 1,
        reportedById: 'u1',
        matchStatus: 'REPORTED',
      },
    });
    expect(cacheSpy).toHaveBeenCalledWith('/matches/m1');
    expect(cacheSpy).toHaveBeenCalledWith('/matches/tournament/t1');
    expect(cacheSpy).toHaveBeenCalledWith('/tournaments/t1');
  });

  it('confirms match and finalizes progression', async () => {
    const match = {
      id: 'm1',
      tournamentId: 't1',
      reportedScoreA: 2,
      reportedScoreB: 0,
    };
    const prismaTx = mockDeep<PrismaService>();
    const transactionSpy = jest.spyOn(prisma, '$transaction');
    const validateSpy = jest.spyOn(consensusLogic, 'validateConfirm');
    const finalizeSpy = jest.spyOn(
      progressionService,
      'finalizeMatchProgression',
    );
    const statsSpy = jest.spyOn(statsService, 'processTournamentStats');

    prisma.match.findUnique.mockResolvedValueOnce(match as never);
    transactionSpy.mockImplementation(async (cb) => cb(prismaTx));

    await expect(service.confirmMatch('m1', user)).resolves.toEqual({
      message: 'Рахунок підтверджено. Elo нараховано.',
    });

    expect(validateSpy).toHaveBeenCalledWith(match, user);
    expect(finalizeSpy).toHaveBeenCalledWith(prismaTx, match, 2, 0);
    expect(statsSpy).toHaveBeenCalledWith('t1');
  });

  it('forfeits match and updates stats', async () => {
    const dto: ForfeitMatchDto = { forfeitingTeamId: 'team-a' };
    const match = { id: 'm1', tournamentId: 't1' };
    const prismaTx = mockDeep<PrismaService>();
    const transactionSpy = jest.spyOn(prisma, '$transaction');
    const resolveSpy = jest.spyOn(consensusLogic, 'resolveForfeit');
    const finalizeSpy = jest.spyOn(
      progressionService,
      'finalizeMatchProgression',
    );
    const statsSpy = jest.spyOn(statsService, 'processTournamentStats');

    prisma.match.findUnique.mockResolvedValueOnce(match as never);
    consensusLogic.resolveForfeit.mockReturnValueOnce({ scoreA: 0, scoreB: 2 });
    transactionSpy.mockImplementation(async (cb) => cb(prismaTx));

    await expect(service.forfeitMatch('m1', dto, user)).resolves.toEqual({
      message: 'Технічна поразка зарахована. Elo оновлено.',
    });

    expect(resolveSpy).toHaveBeenCalledWith(match, dto, user);
    expect(finalizeSpy).toHaveBeenCalledWith(prismaTx, match, 0, 2);
    expect(statsSpy).toHaveBeenCalledWith('t1');
  });

  it('disputes match and notifies organizer', async () => {
    const dto: DisputeMatchDto = { reason: 'wrong score' };
    const match = {
      id: 'm1',
      tournamentId: 't1',
      tournament: { creator: { email: 'org@example.com' }, title: 'Cup' },
    };
    const validateSpy = jest.spyOn(consensusLogic, 'validateDispute');
    const updateSpy = jest.spyOn(prisma.match, 'update');
    const mailSpy = jest.spyOn(mailService, 'sendMatchDisputeNotification');

    prisma.match.findUnique.mockResolvedValueOnce(match as never);
    prisma.match.update.mockResolvedValueOnce({ id: 'm1' } as never);
    mailService.sendMatchDisputeNotification.mockResolvedValueOnce();

    await expect(service.disputeMatch('m1', dto, user)).resolves.toEqual({
      id: 'm1',
    });

    expect(validateSpy).toHaveBeenCalledWith(match, user);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { matchStatus: 'DISPUTED', disputeReason: dto.reason },
    });
    expect(mailSpy).toHaveBeenCalledWith(
      'org@example.com',
      'Cup',
      'm1',
      'wrong score',
    );
  });

  it('force resolves match and clears dispute reason', async () => {
    const dto: ReportScoreDto = { scoreA: 2, scoreB: 1 };
    const match = { id: 'm1', tournamentId: 't1' };
    const prismaTx = mockDeep<PrismaService>();
    const transactionSpy = jest.spyOn(prisma, '$transaction');
    const validateSpy = jest.spyOn(consensusLogic, 'validateForceResolve');
    const finalizeSpy = jest.spyOn(
      progressionService,
      'finalizeMatchProgression',
    );
    const statsSpy = jest.spyOn(statsService, 'processTournamentStats');
    const updateSpy = jest.spyOn(prismaTx.match, 'update');

    prisma.match.findUnique.mockResolvedValueOnce(match as never);
    transactionSpy.mockImplementation(async (cb) => cb(prismaTx));

    await expect(service.forceResolveMatch('m1', dto, user)).resolves.toEqual({
      message: 'Матч примусово закрито. Elo нараховано.',
    });

    expect(validateSpy).toHaveBeenCalledWith(match, user);
    expect(finalizeSpy).toHaveBeenCalledWith(prismaTx, match, 2, 1);
    expect(statsSpy).toHaveBeenCalledWith('t1');
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { disputeReason: null },
    });
  });

  it('disputeMatch catches email sending errors without failing', async () => {
    const dto: DisputeMatchDto = { reason: 'test' };
    const match = {
      id: 'm1',
      tournamentId: 't1',
      tournament: { creator: { email: 'org@example.com' }, title: 'Cup' },
    };

    prisma.match.findUnique.mockResolvedValueOnce(match as never);
    prisma.match.update.mockResolvedValueOnce({ id: 'm1' } as never);

    mailService.sendMatchDisputeNotification.mockRejectedValueOnce(
      new Error('SMTP Error'),
    );

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(service.disputeMatch('m1', dto, user)).resolves.toEqual({
      id: 'm1',
    });

    await new Promise((resolve) => process.nextTick(resolve));

    expect(consoleSpy.mock.calls.length).toBe(1);
    expect(consoleSpy.mock.calls[0][0]).toBe(
      'Помилка відправки листа про диспут:',
    );
    expect(consoleSpy.mock.calls[0][1]).toBeInstanceOf(Error);

    consoleSpy.mockRestore();
  });
});
