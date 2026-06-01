import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TeamInvitationsController } from './team-invitations.controller';
import { TeamInvitationsService } from './team-invitations.service';
import { TeamInvitationsQueryService } from './team-invitations-query.service';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TeamInvitationsController', () => {
  let controller: TeamInvitationsController;
  let service: MockProxy<TeamInvitationsService>;
  let queryService: MockProxy<TeamInvitationsQueryService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'test@test.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    service = mock<TeamInvitationsService>();
    queryService = mock<TeamInvitationsQueryService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamInvitationsController],
      providers: [
        { provide: TeamInvitationsService, useValue: service },
        { provide: TeamInvitationsQueryService, useValue: queryService },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<TeamInvitationsController>(
      TeamInvitationsController,
    );
  });

  it('create делегує виклик у сервіс', async () => {
    const dto = { teamId: 't1', playerNickname: 'nick' };
    service.create.mockResolvedValueOnce({ message: 'ok', inviteId: 'i1' });

    const result = await controller.create(dto, user);
    expect(result.inviteId).toBe('i1');
    expect(service.create.mock.calls[0]).toEqual([dto, user]);
  });

  it('accept делегує виклик у сервіс', async () => {
    const dto = { playerId: 'p1' };
    service.accept.mockResolvedValueOnce({ id: 'i1' } as never);

    const result = await controller.accept('token1', dto, user);
    expect(result).toMatchObject({ id: 'i1' });
    expect(service.accept.mock.calls[0]).toEqual(['token1', 'p1', 'u1']);
  });

  it('decline делегує виклик у сервіс', async () => {
    service.decline.mockResolvedValueOnce({ id: 'i1' } as never);
    const result = await controller.decline('token1', user);
    expect(result).toMatchObject({ id: 'i1' });
    expect(service.decline.mock.calls[0]).toEqual(['token1', 'u1']);
  });

  it('findAll делегує виклик у queryService', async () => {
    queryService.findAll.mockResolvedValueOnce([]);
    const result = await controller.findAll();
    expect(result).toEqual([]);
    expect(queryService.findAll.mock.calls.length).toBe(1);
  });

  it('findMyInvites делегує виклик у queryService', async () => {
    queryService.findMyInvites.mockResolvedValueOnce([]);
    const result = await controller.findMyInvites(user);
    expect(result).toEqual([]);
    expect(queryService.findMyInvites.mock.calls[0]).toEqual(['u1']);
  });
});
