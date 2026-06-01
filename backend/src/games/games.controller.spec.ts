import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { mock, MockProxy } from 'jest-mock-extended';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

describe('GamesController', () => {
  let controller: GamesController;
  let service: MockProxy<GamesService>;

  beforeEach(async () => {
    service = mock<GamesService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        { provide: GamesService, useValue: service },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<GamesController>(GamesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delegates to service', async () => {
    const dto = { name: 'Dota 2', slug: 'dota2' };
    service.create.mockResolvedValueOnce({ id: 'g1', ...dto } as never);

    const result = await controller.create(dto);

    expect(service.create.mock.calls[0]).toEqual([dto]);
    expect(result).toHaveProperty('id', 'g1');
  });

  it('findAll delegates to service', async () => {
    service.findAll.mockResolvedValueOnce([]);

    const result = await controller.findAll();

    expect(service.findAll.mock.calls.length).toBe(1);
    expect(result).toEqual([]);
  });

  it('findOne delegates to service', async () => {
    service.findOne.mockResolvedValueOnce({ id: 'g1', name: 'CS2' } as never);

    const result = await controller.findOne('g1');

    expect(service.findOne.mock.calls[0]).toEqual(['g1']);
    expect(result).toHaveProperty('id', 'g1');
  });

  it('update delegates to service', async () => {
    const dto = { name: 'Counter-Strike 2' };
    service.update.mockResolvedValueOnce({ id: 'g1', ...dto } as never);

    const result = await controller.update('g1', dto);

    expect(service.update.mock.calls[0]).toEqual(['g1', dto]);
    expect(result).toHaveProperty('name', 'Counter-Strike 2');
  });

  it('remove delegates to service', async () => {
    service.remove.mockResolvedValueOnce({ id: 'g1' } as never);

    const result = await controller.remove('g1');

    expect(service.remove.mock.calls[0]).toEqual(['g1']);
    expect(result).toHaveProperty('id', 'g1');
  });
});
