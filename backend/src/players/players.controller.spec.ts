import { Test, TestingModule } from '@nestjs/testing';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { TeamTransfersService } from '../teams/team-transfers.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { GameSlug } from './player.enums';
import { UpdatePlayerDto } from './dto/update-player.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CacheInterceptor, CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Reflector } from '@nestjs/core';

describe('PlayersController', () => {
  let controller: PlayersController;
  let playersService: MockProxy<PlayersService>;
  let transfersService: MockProxy<TeamTransfersService>;
  let cacheManager: MockProxy<Cache>;

  beforeEach(async () => {
    playersService = mock<PlayersService>();
    transfersService = mock<TeamTransfersService>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlayersController],
      providers: [
        { provide: PlayersService, useValue: playersService },
        { provide: TeamTransfersService, useValue: transfersService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: Reflector, useValue: mock<Reflector>() },
        { provide: CacheInterceptor, useValue: { intercept: jest.fn() } },
      ],
    }).compile();

    controller = module.get<PlayersController>(PlayersController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delegates to service', async () => {
    const dto: CreatePlayerDto = {
      gameSlug: GameSlug.CS2,
      nickname: 'player1',
    };
    const user = { userId: 'u1' } as JwtPayload;
    const createSpy = jest.spyOn(playersService, 'create');

    playersService.create.mockResolvedValueOnce({ id: 'p1' } as never);

    await expect(controller.create(dto, user)).resolves.toEqual({ id: 'p1' });

    expect(createSpy).toHaveBeenCalledWith(dto, 'u1');
  });

  it('findAll delegates to service', async () => {
    const findAllSpy = jest.spyOn(playersService, 'findAll');
    playersService.findAll.mockResolvedValueOnce([{ id: 'p1' }] as never);

    await expect(controller.findAll()).resolves.toEqual([{ id: 'p1' }]);

    expect(findAllSpy).toHaveBeenCalledTimes(1);
  });

  it('findMyProfiles delegates to service', async () => {
    const user = { userId: 'u1' } as JwtPayload;
    const findMyProfilesSpy = jest.spyOn(playersService, 'findMyProfiles');
    playersService.findMyProfiles.mockResolvedValueOnce([
      { id: 'p1' },
    ] as never);

    await expect(controller.findMyProfiles(user)).resolves.toEqual([
      { id: 'p1' },
    ]);

    expect(findMyProfilesSpy).toHaveBeenCalledWith('u1');
  });

  it('findOne delegates to service', async () => {
    const findOneSpy = jest.spyOn(playersService, 'findOne');
    playersService.findOne.mockResolvedValueOnce({ id: 'p1' } as never);

    await expect(controller.findOne('p1')).resolves.toEqual({ id: 'p1' });

    expect(findOneSpy).toHaveBeenCalledWith('p1');
  });

  it('getPlayerTransfers delegates to transfers service', async () => {
    const transfersSpy = jest.spyOn(transfersService, 'getPlayerTransfers');
    transfersService.getPlayerTransfers.mockResolvedValueOnce([
      { id: 't1' },
    ] as never);

    await expect(controller.getPlayerTransfers('p1')).resolves.toEqual([
      { id: 't1' },
    ]);

    expect(transfersSpy).toHaveBeenCalledWith('p1');
  });

  it('update delegates to service', async () => {
    const dto: UpdatePlayerDto = { nickname: 'new' };
    const user = { userId: 'u1' } as JwtPayload;
    const updateSpy = jest.spyOn(playersService, 'update');

    playersService.update.mockResolvedValueOnce({ id: 'p1' } as never);

    await expect(controller.update('p1', dto, user)).resolves.toEqual({
      id: 'p1',
    });

    expect(updateSpy).toHaveBeenCalledWith('p1', dto, 'u1');
  });

  it('remove delegates to service', async () => {
    const user = { userId: 'u1' } as JwtPayload;
    const removeSpy = jest.spyOn(playersService, 'remove');

    playersService.remove.mockResolvedValueOnce({
      message: 'Ігровий профіль успішно видалено',
    } as never);

    await expect(controller.remove('p1', user)).resolves.toEqual({
      message: 'Ігровий профіль успішно видалено',
    });

    expect(removeSpy).toHaveBeenCalledWith('p1', 'u1');
  });
});
