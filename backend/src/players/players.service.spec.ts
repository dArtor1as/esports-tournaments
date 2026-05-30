import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, DeepMockProxy, mockDeep, MockProxy } from 'jest-mock-extended';
import { PlayersService } from './players.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreatePlayerDto } from './dto/create-player.dto';
import { GameSlug } from './player.enums';
import { UpdatePlayerDto } from './dto/update-player.dto';

describe('PlayersService', () => {
  let service: PlayersService;
  let prisma: DeepMockProxy<PrismaService>;
  let cacheManager: MockProxy<Cache>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('throws if profile already exists', async () => {
      const dto: CreatePlayerDto = {
        gameSlug: GameSlug.CS2,
        nickname: 'player1',
      };

      prisma.player.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);

      await expect(service.create(dto, 'u1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates player with generated rating and clears cache', async () => {
      const dto: CreatePlayerDto = {
        gameSlug: GameSlug.CS2,
        nickname: 'player1',
        expectedTier: 1,
      };
      const createSpy = jest.spyOn(prisma.player, 'create');
      const cacheDelSpy = jest.spyOn(cacheManager, 'del');

      prisma.player.findFirst.mockResolvedValueOnce(null);
      prisma.player.create.mockResolvedValueOnce({ id: 'p1' } as never);

      jest.spyOn(Math, 'random').mockReturnValue(0);

      await expect(service.create(dto, 'u1')).resolves.toEqual({ id: 'p1' });

      const [createArgs] = createSpy.mock.calls[0];

      expect(createArgs).toMatchObject({
        data: {
          user: { connect: { id: 'u1' } },
          game: { connect: { slug: GameSlug.CS2 } },
          rating: 2500,
        },
      });
      expect(cacheDelSpy).toHaveBeenCalledWith('all_players');
    });
  });

  describe('update', () => {
    it('throws when profile not found', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('p1', { nickname: 'new' }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when user is not owner', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u2',
        game: { slug: GameSlug.CS2 },
      } as never);

      await expect(
        service.update('p1', { nickname: 'new' }, 'u1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates profile and clears cache', async () => {
      const dto: UpdatePlayerDto = { nickname: 'new' };
      const updateSpy = jest.spyOn(prisma.player, 'update');
      const cacheDelSpy = jest.spyOn(cacheManager, 'del');

      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        game: { slug: GameSlug.CS2 },
      } as never);
      prisma.player.update.mockResolvedValueOnce({ id: 'p1' } as never);

      await expect(service.update('p1', dto, 'u1')).resolves.toEqual({
        id: 'p1',
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: dto,
      });
      expect(cacheDelSpy).toHaveBeenCalledWith('all_players');
    });
  });

  describe('remove', () => {
    it('throws when profile not found', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('p1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when user is not owner', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u2',
      } as never);

      await expect(service.remove('p1', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes profile and clears cache', async () => {
      const deleteSpy = jest.spyOn(prisma.player, 'delete');
      const cacheDelSpy = jest.spyOn(cacheManager, 'del');

      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
      } as never);
      prisma.player.delete.mockResolvedValueOnce({ id: 'p1' } as never);

      await expect(service.remove('p1', 'u1')).resolves.toEqual({
        message: 'Ігровий профіль успішно видалено',
      });

      expect(deleteSpy).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(cacheDelSpy).toHaveBeenCalledWith('all_players');
    });
  });
});
