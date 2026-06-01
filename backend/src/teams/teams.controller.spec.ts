import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamTransfersService } from './team-transfers.service';
import { Region, Role, RosterRole } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TeamsController', () => {
  let controller: TeamsController;
  let teamsService: MockProxy<TeamsService>;
  let transfersService: MockProxy<TeamTransfersService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'test@test.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    teamsService = mock<TeamsService>();
    transfersService = mock<TeamTransfersService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        { provide: TeamsService, useValue: teamsService },
        { provide: TeamTransfersService, useValue: transfersService },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delegated to service', async () => {
    const dto = {
      name: 'Test',
      tag: 'TST',
      captainPlayerId: 'p1',
      region: Region.EU,
    };
    teamsService.create.mockResolvedValueOnce({ id: 't1' } as never);
    const result = await controller.create(dto, user);
    expect(result).toEqual({ id: 't1' });
    expect(teamsService.create.mock.calls[0]).toEqual([dto, user.userId]);
  });

  it('findAll delegated to service', async () => {
    teamsService.findAll.mockResolvedValueOnce([]);
    const result = await controller.findAll();
    expect(result).toEqual([]);
    expect(teamsService.findAll.mock.calls.length).toBe(1);
  });

  it('findOne delegated to service', async () => {
    teamsService.findOne.mockResolvedValueOnce({ id: 't1' } as never);
    const result = await controller.findOne('t1');
    expect(result).toEqual({ id: 't1' });
    expect(teamsService.findOne.mock.calls[0]).toEqual(['t1']);
  });

  it('update delegated to service', async () => {
    const dto = { name: 'New Name' };
    teamsService.update.mockResolvedValueOnce({ id: 't1' } as never);
    const result = await controller.update('t1', dto, user);
    expect(result).toEqual({ id: 't1' });
    expect(teamsService.update.mock.calls[0]).toEqual(['t1', dto, user]);
  });

  it('updatePlayerTeamRole delegated to service', async () => {
    teamsService.updatePlayerTeamRole.mockResolvedValueOnce({
      message: 'ok',
      newRole: RosterRole.PLAYER,
    });
    // Виправлення: передаємо об'єкт DTO, як це очікує NestJS
    const result = await controller.updatePlayerTeamRole(
      't1',
      'p1',
      { teamRole: RosterRole.PLAYER },
      user,
    );
    expect(result.message).toBe('ok');
    expect(teamsService.updatePlayerTeamRole.mock.calls[0]).toEqual([
      't1',
      'p1',
      RosterRole.PLAYER,
      user,
    ]);
  });

  it('transferLeadership delegated to transfersService', async () => {
    transfersService.transferLeadership.mockResolvedValueOnce({
      message: 'ok',
      newCaptainId: 'p2',
    });
    const result = await controller.transferLeadership('t1', 'p2', user);
    expect(result.message).toBe('ok');
    expect(transfersService.transferLeadership.mock.calls[0]).toEqual([
      't1',
      'p2',
      user,
    ]);
  });

  it('remove delegated to teamsService', async () => {
    teamsService.remove.mockResolvedValueOnce({ id: 't1' } as never);
    const result = await controller.remove('t1', user);
    expect(result.id).toBe('t1');
    expect(teamsService.remove.mock.calls[0]).toEqual(['t1', user]);
  });

  it('leaveTeam delegated to transfersService', async () => {
    transfersService.leaveTeam.mockResolvedValueOnce({ message: 'ok' });
    const result = await controller.leaveTeam('t1', 'p1', user);
    expect(result.message).toBe('ok');
    expect(transfersService.leaveTeam.mock.calls[0]).toEqual([
      't1',
      'p1',
      user,
    ]);
  });

  it('kickPlayer delegated to transfersService', async () => {
    transfersService.kickPlayer.mockResolvedValueOnce({ message: 'ok' });
    const result = await controller.kickPlayer('t1', 'p1', user);
    expect(result.message).toBe('ok');
    expect(transfersService.kickPlayer.mock.calls[0]).toEqual([
      't1',
      'p1',
      user,
    ]);
  });
});
