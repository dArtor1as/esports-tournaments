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
import { AccessPolicyService } from 'src/auth/access-policy.service';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('PlayersService', () => {
  let service: PlayersService;
  let prisma: DeepMockProxy<PrismaService>;
  let cacheManager: MockProxy<Cache>;
  let accessPolicy: MockProxy<AccessPolicyService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    cacheManager = mock<Cache>();
    accessPolicy = mock<AccessPolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: AccessPolicyService, useValue: accessPolicy },
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
    const dto: UpdatePlayerDto = { nickname: 'new' };
    const mockUser = {
      userId: 'u1',
      email: 'test@test.com',
      role: 'USER',
    } as unknown as JwtPayload;

    it('throws when profile not found', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(null);

      // ВИПРАВЛЕНО: Передаємо об'єкт mockUser замість рядка
      await expect(service.update('p1', dto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when user is not owner', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u2',
        game: { slug: 'cs2' },
      } as never);

      // ВИПРАВЛЕНО: Примушуємо мок викинути помилку доступу!
      accessPolicy.checkSelfOrAdmin.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.update('p1', dto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updates profile and clears cache', async () => {
      const updateSpy = jest.spyOn(prisma.player, 'update');
      const cacheDelSpy = jest.spyOn(cacheManager, 'del');

      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        game: { slug: 'cs2' },
      } as never);
      prisma.player.update.mockResolvedValueOnce({ id: 'p1' } as never);

      await expect(service.update('p1', dto, mockUser)).resolves.toEqual({
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
    const mockUser = {
      userId: 'u1',
      email: 'test@test.com',
      role: 'USER',
    } as unknown as JwtPayload;

    it('throws when profile not found', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('p1', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when user is not owner', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u2',
      } as never);

      accessPolicy.checkSelfOrAdmin.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.remove('p1', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('anonymizes profile and clears cache', async () => {
      const cacheDelSpy = jest.spyOn(cacheManager, 'del');

      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
      } as never);

      // Імітуємо виконання транзакції
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));
      // Імітуємо оновлення (софт-деліт)
      prisma.player.update.mockResolvedValueOnce({ id: 'p1' } as never);

      await expect(service.remove('p1', mockUser)).resolves.toEqual({
        message: 'Ігровий профіль успішно анонімізовано',
      });

      expect(cacheDelSpy).toHaveBeenCalledWith('all_players');
    });
  });
});
