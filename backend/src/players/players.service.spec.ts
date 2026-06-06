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
          rating: 2700,
        },
      });
      expect(cacheDelSpy).toHaveBeenCalledWith('all_players');
    });

    it('creates player with tier 2 rating', async () => {
      const dto: CreatePlayerDto = {
        gameSlug: GameSlug.CS2,
        nickname: 'p2',
        expectedTier: 2,
      };
      const createSpy = jest.spyOn(prisma.player, 'create');

      prisma.player.findFirst.mockResolvedValueOnce(null);
      prisma.player.create.mockResolvedValueOnce({ id: 'p2' } as never);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await service.create(dto, 'u1');

      const [createArgs] = createSpy.mock.calls[0];
      expect(createArgs).toMatchObject({ data: { rating: 1800 } });
    });

    it('creates player with tier 3 rating', async () => {
      const dto: CreatePlayerDto = {
        gameSlug: GameSlug.CS2,
        nickname: 'p3',
        expectedTier: 3,
      };
      const createSpy = jest.spyOn(prisma.player, 'create');

      prisma.player.findFirst.mockResolvedValueOnce(null);
      prisma.player.create.mockResolvedValueOnce({ id: 'p3' } as never);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await service.create(dto, 'u1');

      const [createArgs] = createSpy.mock.calls[0];
      expect(createArgs).toMatchObject({ data: { rating: 800 } });
    });
  });

  describe('findAll', () => {
    it('returns all non-deleted players', async () => {
      const findManySpy = jest.spyOn(prisma.player, 'findMany');
      prisma.player.findMany.mockResolvedValueOnce([{ id: 'p1' }] as never);

      await expect(service.findAll()).resolves.toEqual([{ id: 'p1' }]);

      const [findArgs] = findManySpy.mock.calls[0];
      expect(findArgs).toMatchObject({ where: { deletedAt: null } });
    });

    it('returns players for a specific user', async () => {
      const findManySpy = jest.spyOn(prisma.player, 'findMany');
      prisma.player.findMany.mockResolvedValueOnce([{ id: 'p1' }] as never);

      await expect(service.findAll('u1')).resolves.toEqual([{ id: 'p1' }]);

      const [findArgs] = findManySpy.mock.calls[0];
      expect(findArgs).toMatchObject({
        where: { deletedAt: null, userId: 'u1' },
      });
    });
  });

  describe('findMyProfiles', () => {
    it('returns user profiles', async () => {
      const findManySpy = jest.spyOn(prisma.player, 'findMany');
      prisma.player.findMany.mockResolvedValueOnce([{ id: 'p1' }] as never);

      await expect(service.findMyProfiles('u1')).resolves.toEqual([
        { id: 'p1' },
      ]);

      const [findArgs] = findManySpy.mock.calls[0];
      expect(findArgs).toMatchObject({
        where: { userId: 'u1', deletedAt: null },
      });
    });
  });

  describe('findOne', () => {
    it('returns a profile by id without deletedAt filter', async () => {
      const findUniqueSpy = jest.spyOn(prisma.player, 'findUnique');
      prisma.player.findUnique.mockResolvedValueOnce({ id: 'p1' } as never);

      await expect(service.findOne('p1')).resolves.toEqual({ id: 'p1' });

      const [findArgs] = findUniqueSpy.mock.calls[0];
      expect(findArgs).toMatchObject({ where: { id: 'p1' } });
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

      // Передаємо об'єкт mockUser замість рядка
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

      // Примушуємо мок викинути помилку доступу!
      accessPolicy.checkSelfOrAdmin.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.update('p1', dto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws when profile is deleted', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        deletedAt: new Date(),
      } as never);

      await expect(service.update('p1', dto, mockUser)).rejects.toThrow(
        NotFoundException,
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
    it('reassigns captain if player is captain and other players exist', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        teamId: 't1',
      } as never);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));

      // Мок пошуку команди з іншим гравцем
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p1',
        players: [{ id: 'p1' }, { id: 'p2' }],
      } as never);

      const updateTeamSpy = jest.spyOn(prisma.team, 'update');
      const updatePlayerSpy = jest.spyOn(prisma.player, 'update');

      await service.remove('p1', mockUser);

      // Перевіряємо призначення нового капітана
      expect(updateTeamSpy).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { captainId: 'p2' },
      });
      // Перевіряємо зміну ролі у нового капітана
      expect(updatePlayerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p2' },
          data: { teamRole: 'CAPTAIN' },
        }),
      );
    });

    it('disbands team if player is captain and no other players exist', async () => {
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        teamId: 't1',
      } as never);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));

      // Мок пошуку команди без інших гравців
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p1',
        players: [{ id: 'p1' }],
      } as never);

      const updateTeamSpy = jest.spyOn(prisma.team, 'update');

      await service.remove('p1', mockUser);

      // Перевіряємо розпуск команди
      expect(updateTeamSpy).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'DISBANDED' },
      });
    });
  });
});
