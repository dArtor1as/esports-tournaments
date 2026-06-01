import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy, mock, MockProxy } from 'jest-mock-extended';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GamesService } from './games.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('GamesService', () => {
  let service: GamesService;
  let prisma: DeepMockProxy<PrismaService>;
  let cacheManager: MockProxy<Cache>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('викидає ConflictException, якщо slug вже зайнятий', async () => {
      prisma.game.findUnique.mockResolvedValueOnce({ id: 'existing' } as never);

      await expect(
        service.create({ name: 'CS2', slug: 'cs2' }),
      ).rejects.toThrow(ConflictException);
    });

    it('успішно створює гру та очищує кеш', async () => {
      prisma.game.findUnique.mockResolvedValueOnce(null);
      prisma.game.create.mockResolvedValueOnce({ id: 'new-game' } as never);

      const result = await service.create({ name: 'CS2', slug: 'cs2' });

      expect(cacheManager.del.mock.calls[0]).toEqual(['all_games']);

      const createCall = prisma.game.create.mock
        .calls[0][0] as Prisma.GameCreateArgs;
      expect(createCall.data).toEqual({ name: 'CS2', slug: 'cs2' });
      expect(result).toHaveProperty('id', 'new-game');
    });
  });

  describe('findAll', () => {
    it('повертає список ігор зі статистикою', async () => {
      prisma.game.findMany.mockResolvedValueOnce([{ id: 'g1' }] as never);

      const result = await service.findAll();

      const findManyCall = prisma.game.findMany.mock
        .calls[0][0] as Prisma.GameFindManyArgs;
      expect(findManyCall.include?._count).toBeDefined();
      expect(result).toEqual([{ id: 'g1' }]);
    });
  });

  describe('findOne', () => {
    it('викидає NotFoundException, якщо гру не знайдено', async () => {
      prisma.game.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('g1')).rejects.toThrow(NotFoundException);
    });

    it('повертає гру', async () => {
      prisma.game.findUnique.mockResolvedValueOnce({ id: 'g1' } as never);

      const result = await service.findOne('g1');

      expect(result).toHaveProperty('id', 'g1');
    });
  });

  describe('update', () => {
    it('не перевіряє унікальність slug, якщо він не переданий', async () => {
      prisma.game.update.mockResolvedValueOnce({ id: 'g1' } as never);

      await service.update('g1', { name: 'New Name' });

      expect(prisma.game.findFirst.mock.calls.length).toBe(0);
      expect(cacheManager.del.mock.calls[0]).toEqual(['all_games']);
      expect(prisma.game.update.mock.calls.length).toBe(1);
    });

    it('викидає ConflictException, якщо новий slug вже зайнятий іншою грою', async () => {
      prisma.game.findFirst.mockResolvedValueOnce({
        id: 'other-game',
      } as never);

      await expect(
        service.update('g1', { slug: 'existing-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('успішно оновлює гру зі slug та очищує кеш', async () => {
      prisma.game.findFirst.mockResolvedValueOnce(null); // Slug вільний
      prisma.game.update.mockResolvedValueOnce({ id: 'g1' } as never);

      await service.update('g1', { name: 'CS2', slug: 'cs2' });

      expect(cacheManager.del.mock.calls[0]).toEqual(['all_games']);

      const updateCall = prisma.game.update.mock
        .calls[0][0] as Prisma.GameUpdateArgs;
      expect(updateCall.data).toEqual({ name: 'CS2', slug: 'cs2' });
    });
  });

  describe('remove', () => {
    it('викидає NotFoundException, якщо гру не знайдено', async () => {
      prisma.game.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('g1')).rejects.toThrow(NotFoundException);
    });

    it("викидає BadRequestException, якщо до гри прив'язані гравці", async () => {
      prisma.game.findUnique.mockResolvedValueOnce({
        id: 'g1',
        _count: { players: 5, tournaments: 0 },
      } as never);

      await expect(service.remove('g1')).rejects.toThrow(BadRequestException);
    });

    it("викидає BadRequestException, якщо до гри прив'язані турніри", async () => {
      prisma.game.findUnique.mockResolvedValueOnce({
        id: 'g1',
        _count: { players: 0, tournaments: 2 },
      } as never);

      await expect(service.remove('g1')).rejects.toThrow(BadRequestException);
    });

    it("успішно видаляє гру та очищує кеш, якщо немає зв'язків", async () => {
      prisma.game.findUnique.mockResolvedValueOnce({
        id: 'g1',
        _count: { players: 0, tournaments: 0 },
      } as never);
      prisma.game.delete.mockResolvedValueOnce({ id: 'g1' } as never);

      const result = await service.remove('g1');

      expect(prisma.game.delete.mock.calls[0][0]).toEqual({
        where: { id: 'g1' },
      });
      expect(cacheManager.del.mock.calls[0]).toEqual(['all_games']);
      expect(result).toHaveProperty('id', 'g1');
    });
  });
});
