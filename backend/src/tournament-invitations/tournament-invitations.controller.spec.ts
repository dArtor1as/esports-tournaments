import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { mock, MockProxy } from 'jest-mock-extended';
import { TournamentInvitationsController } from './tournament-invitations.controller';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { TournamentInvitationsQueryService } from './tournament-invitations-query.service';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TournamentInvitationsController', () => {
  let controller: TournamentInvitationsController;
  let service: MockProxy<TournamentInvitationsService>;
  let queryService: MockProxy<TournamentInvitationsQueryService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'test@test.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    service = mock<TournamentInvitationsService>();
    queryService = mock<TournamentInvitationsQueryService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentInvitationsController],
      providers: [
        { provide: TournamentInvitationsService, useValue: service },
        { provide: TournamentInvitationsQueryService, useValue: queryService },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<TournamentInvitationsController>(
      TournamentInvitationsController,
    );
  });

  // УСІ EXPECT ВИПРАВЛЕНО НА mock.calls
  it('should delegate create', async () => {
    service.create.mockResolvedValueOnce({
      message: 'ok',
      inviteId: 'inv1',
    } as never);
    const dto = { tournamentId: 't1', teamId: 'team1' };
    const result = await controller.create(dto, user);
    expect(service.create.mock.calls[0]).toEqual([dto, user]);
    expect(result).toHaveProperty('inviteId', 'inv1');
  });

  it('should delegate accept', async () => {
    service.accept.mockResolvedValueOnce({ id: 'p1' } as never);
    const dto = { rosterPlayerIds: ['p1'] };
    const result = await controller.accept('token1', dto, user);
    expect(service.accept.mock.calls[0]).toEqual(['token1', dto, user]);
    expect(result).toHaveProperty('id', 'p1');
  });

  it('should delegate decline', async () => {
    service.decline.mockResolvedValueOnce({ id: 'inv1' } as never);
    const result = await controller.decline('token1', user);
    expect(service.decline.mock.calls[0]).toEqual(['token1', user]);
    expect(result).toHaveProperty('id', 'inv1');
  });

  it('should delegate findAllByTournament', async () => {
    queryService.findAllByTournament.mockResolvedValueOnce([]);
    const result = await controller.findAllByTournament('t1', user);
    expect(queryService.findAllByTournament.mock.calls[0]).toEqual([
      't1',
      user,
    ]);
    expect(result).toEqual([]);
  });

  it('should delegate findMyTeamInvites', async () => {
    queryService.findMyTeamInvites.mockResolvedValueOnce([]);
    const result = await controller.findMyTeamInvites(user);
    expect(queryService.findMyTeamInvites.mock.calls[0]).toEqual(['u1']);
    expect(result).toEqual([]);
  });
});
