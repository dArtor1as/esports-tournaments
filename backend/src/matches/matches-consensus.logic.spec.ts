import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import {
  MatchesConsensusLogic,
  ConsensusMatch,
} from './matches-consensus.logic';
import { AccessPolicyService } from '../auth/access-policy.service';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import { Role } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('MatchesConsensusLogic', () => {
  let logic: MatchesConsensusLogic;
  let accessPolicy: MockProxy<AccessPolicyService>;

  const adminUser: JwtPayload = {
    userId: 'admin',
    email: 'admin@example.com',
    role: Role.ADMIN,
  };

  beforeEach(() => {
    accessPolicy = mock<AccessPolicyService>();
    logic = new MatchesConsensusLogic(accessPolicy);
  });

  it('resolves forfeit for team A captain', () => {
    const match = {
      id: 'm1',
      isProcessed: false,
      tournament: { status: 'live', creatorId: 'u1' },
      teamAId: 'team-a',
      teamBId: 'team-b',
      bestOf: 3,
      teamA: { captain: { userId: 'u1' } },
      teamB: { captain: { userId: 'u2' } },
    } as ConsensusMatch;
    const dto: ForfeitMatchDto = {};
    const user = { userId: 'u1', email: 'u1@example.com', role: Role.USER };

    const result = logic.resolveForfeit(match, dto, user);

    expect(result).toEqual({ scoreA: 0, scoreB: 2 });
  });

  it('resolves forfeit for team B captain', () => {
    const match = {
      id: 'm1',
      isProcessed: false,
      tournament: { status: 'live', creatorId: 'u1' },
      teamAId: 'team-a',
      teamBId: 'team-b',
      bestOf: 1,
      teamA: { captain: { userId: 'u1' } },
      teamB: { captain: { userId: 'u2' } },
    } as ConsensusMatch;
    const dto: ForfeitMatchDto = {};
    const user = { userId: 'u2', email: 'u2@example.com', role: Role.USER };

    const result = logic.resolveForfeit(match, dto, user);

    expect(result).toEqual({ scoreA: 1, scoreB: 0 });
  });

  it('requires forfeiting team for admin', () => {
    const accessSpy = jest.spyOn(accessPolicy, 'checkTournamentCreatorOrAdmin');
    const match = {
      id: 'm1',
      isProcessed: false,
      tournament: { status: 'live', creatorId: 'u1' },
      teamAId: 'team-a',
      teamBId: 'team-b',
      bestOf: 3,
      teamA: { captain: { userId: 'u1' } },
      teamB: { captain: { userId: 'u2' } },
    } as ConsensusMatch;

    expect(() => logic.resolveForfeit(match, {}, adminUser)).toThrow(
      new BadRequestException(
        'Адміністратор або Організатор повинен вказати ID команди, яку дискваліфікують',
      ),
    );
    expect(accessSpy).toHaveBeenCalledWith('u1', adminUser);
  });

  it('validates report from captain only', () => {
    const match = {
      matchStatus: 'PENDING',
      teamA: { captain: { userId: 'u1' } },
      teamB: { captain: { userId: 'u2' } },
    } as ConsensusMatch;

    expect(() =>
      logic.validateReport(match, { userId: 'x' } as JwtPayload),
    ).toThrow(new ForbiddenException('Тільки капітани можуть вносити рахунок'));
  });

  it('validates confirm for opponent', () => {
    const match = {
      matchStatus: 'REPORTED',
      reportedById: 'u1',
      teamA: { captain: { userId: 'u1' } },
      teamB: { captain: { userId: 'u2' } },
    } as ConsensusMatch;

    expect(() =>
      logic.validateConfirm(match, { userId: 'u1' } as JwtPayload),
    ).toThrow(
      new BadRequestException(
        'Ви не можете підтвердити власний звіт. Чекайте на опонента.',
      ),
    );
  });

  it('validates dispute for non-reporter', () => {
    const match = {
      matchStatus: 'REPORTED',
      reportedById: 'u1',
    } as ConsensusMatch;

    expect(() =>
      logic.validateDispute(match, { userId: 'u1' } as JwtPayload),
    ).toThrow(new BadRequestException('Ви не можете оскаржити власний звіт'));
  });

  it('validates force resolve for admin or creator', () => {
    const accessSpy = jest.spyOn(accessPolicy, 'checkTournamentCreatorOrAdmin');
    const match = {
      matchStatus: 'REPORTED',
      tournament: { creatorId: 'u1' },
    } as ConsensusMatch;

    logic.validateForceResolve(match, adminUser);

    expect(accessSpy).toHaveBeenCalledWith('u1', adminUser);
  });
});
