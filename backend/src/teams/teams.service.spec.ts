import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy, mock, MockProxy } from 'jest-mock-extended';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from '../auth/access-policy.service';
import { Region, Role, Prisma, RosterRole } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

jest.mock('common/helpers/tier.helper', () => ({
  TierHelper: {
    calculateTier: jest.fn().mockReturnValue('S'),
  },
}));

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let cacheManager: MockProxy<Cache>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'user@test.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mock<AccessPolicyService>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('викидає помилку, якщо гравця не знайдено', async () => {
      prisma.player.findUnique.mockResolvedValueOnce(null);
      prisma.player.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(
          { name: 'A', tag: 'A', captainPlayerId: 'p1', region: Region.EU },
          user.userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('викидає помилку, якщо гравець вже в команді', async () => {
      const mockPlayer = { id: 'p1', teamId: 't1', userId: 'u1' };
      prisma.player.findUnique.mockResolvedValueOnce(mockPlayer as never);
      prisma.player.findFirst.mockResolvedValueOnce(mockPlayer as never);

      await expect(
        service.create(
          { name: 'A', tag: 'A', captainPlayerId: 'p1', region: Region.EU },
          user.userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('викидає помилку, якщо юзер намагається створити команду для іншого гравця', async () => {
      // Імітуємо, що знайдений гравець належить іншому юзеру (не 'u1')
      const mockPlayer = { id: 'p1', teamId: null, userId: 'u2' };
      prisma.player.findUnique.mockResolvedValueOnce(mockPlayer as never);
      prisma.player.findFirst.mockResolvedValueOnce(mockPlayer as never);

      await expect(
        service.create(
          { name: 'A', tag: 'A', captainPlayerId: 'p1', region: Region.EU },
          user.userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
    it('викидає ConflictException, якщо команда з такою назвою або тегом вже існує', async () => {
      const mockPlayer = { id: 'p1', teamId: null, userId: 'u1' };
      prisma.player.findUnique.mockResolvedValue(mockPlayer as never);
      prisma.player.findFirst.mockResolvedValue(mockPlayer as never);
      prisma.team.count.mockResolvedValue(0);

      // Імітуємо, що findFirst для перевірки дублікатів знаходить існуючу команду
      prisma.team.findFirst.mockResolvedValueOnce({
        id: 'existing-team',
      } as never);

      await expect(
        service.create(
          { name: 'A', tag: 'A', captainPlayerId: 'p1', region: Region.EU },
          user.userId,
        ),
      ).rejects.toThrow(ConflictException);
    });
    it('використовує GLOBAL як регіон за замовчуванням, якщо його не вказано', async () => {
      const mockPlayer = {
        id: 'p1',
        teamId: null,
        userId: 'u1',
        rating: 1000,
        gameId: 'g1',
        game: { minTeamSize: 5 },
      };
      prisma.player.findUnique.mockResolvedValue(mockPlayer as never);
      prisma.player.findFirst.mockResolvedValue(mockPlayer as never);
      prisma.team.count.mockResolvedValue(0);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
      prisma.team.create.mockResolvedValue({ id: 'new-t' } as never);

      // Передаємо DTO без region
      await service.create(
        { name: 'A', tag: 'A', captainPlayerId: 'p1' },
        user.userId,
      );

      const createCall = prisma.team.create.mock
        .calls[0][0] as Prisma.TeamCreateArgs;
      expect(createCall.data.region).toBe('GLOBAL');
    });

    it('створює команду успішно', async () => {
      const mockPlayer = {
        id: 'p1',
        teamId: null,
        rating: 1000,
        gameId: 'g1',
        userId: 'u1',
        game: { minTeamSize: 5 },
      };

      // Забезпечуємо наявність гравця для будь-якого методу пошуку
      prisma.player.findUnique.mockResolvedValue(mockPlayer as never);
      prisma.player.findFirst.mockResolvedValue(mockPlayer as never);

      prisma.team.count.mockResolvedValue(0);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      prisma.team.create.mockResolvedValue({ id: 'new-t' } as never);

      const result = await service.create(
        { name: 'A', tag: 'A', captainPlayerId: 'p1', region: Region.EU },
        user.userId,
      );

      expect(result.id).toBe('new-t');
      expect(prisma.team.create.mock.calls.length).toBe(1);
    });
  });

  describe('update', () => {
    it('викидає ConflictException при оновленні, якщо назва або тег вже зайняті', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);

      // Імітуємо знаходження іншої команди з таким самим іменем/тегом
      prisma.team.findFirst.mockResolvedValueOnce({ id: 't2' } as never);

      await expect(
        service.update('t1', { name: 'Taken Name' }, user),
      ).rejects.toThrow(ConflictException);
    });

    it('не перевіряє дублікати, якщо не передано назву чи тег', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);
      prisma.team.update.mockResolvedValueOnce({ id: 't1' } as never);

      // Оновлюємо щось інше, наприклад регіон
      await service.update('t1', { region: Region.NA }, user);

      // findFirst (перевірка дублікатів) не повинен був викликатись
      expect(prisma.team.findFirst.mock.calls.length).toBe(0);
    });

    it('оновлює команду успішно', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);
      prisma.team.update.mockResolvedValueOnce({ id: 't1' } as never);

      // Використовуємо поле `name`, яке 100% є в UpdateTeamDto
      await service.update('t1', { name: 'Updated Name' }, user);

      const updateCall = prisma.team.update.mock
        .calls[0][0] as Prisma.TeamUpdateArgs;
      expect(updateCall.data.name).toBe('Updated Name');
    });
  });

  describe('findAll', () => {
    it('повертає список команд', async () => {
      prisma.team.findMany.mockResolvedValueOnce([{ id: 't1' }] as never);
      const result = await service.findAll();
      expect(result).toEqual([{ id: 't1' }]);
    });
  });

  describe('findOne', () => {
    it('повертає null, якщо команду не знайдено', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      const result = await service.findOne('t1');
      expect(result).toBeNull(); // Змінили очікування на null
    });

    it('повертає команду успішно', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({ id: 't1' } as never);
      const result = await service.findOne('t1');
      expect(result).toEqual({ id: 't1' });
    });
  });

  describe('recalculateTeamCountry', () => {
    it('нічого не робить, якщо команду не знайдено', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      await service.recalculateTeamCountry('t1');
      expect(prisma.team.update.mock.calls.length).toBe(0);
    });
    it('нічого не робить, якщо немає активних гравців', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        isManualCountry: false,
        players: [{ teamRole: 'SUBSTITUTE', user: { countryCode: 'UA' } }], // Тільки заміна
      } as never);
      await service.recalculateTeamCountry('t1');
      expect(prisma.team.update.mock.calls.length).toBe(0);
    });

    it('не оновлює БД, якщо розрахована країна збігається з поточною', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        isManualCountry: false,
        countryCode: 'UA', // Вже UA
        players: [{ teamRole: 'PLAYER', user: { countryCode: 'UA' } }],
      } as never);
      await service.recalculateTeamCountry('t1');
      expect(prisma.team.update.mock.calls.length).toBe(0); // Запит не має відправлятися
    });

    it('оновлює країну на основі більшості гравців', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        isManualCountry: false,
        players: [
          { teamRole: 'PLAYER', user: { countryCode: 'UA' } },
          { teamRole: 'CAPTAIN', user: { countryCode: 'UA' } },
          { teamRole: 'PLAYER', user: { countryCode: 'PL' } },
        ],
      } as never);

      await service.recalculateTeamCountry('t1');

      const updateCall = prisma.team.update.mock
        .calls[0][0] as Prisma.TeamUpdateArgs;
      expect(updateCall.data.countryCode).toBe('UA');
    });
    it('встановлює країну INT, якщо гравці не мають вказаної країни', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        isManualCountry: false,
        players: [{ teamRole: 'PLAYER', user: { countryCode: null } }],
      } as never);

      await service.recalculateTeamCountry('t1');

      const updateCall = prisma.team.update.mock
        .calls[0][0] as Prisma.TeamUpdateArgs;
      expect(updateCall.data.countryCode).toBe('INT');
    });
  });

  describe('updatePlayerTeamRole', () => {
    it('викидає помилку, якщо команду не знайдено', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updatePlayerTeamRole('t1', 'p1', RosterRole.SUBSTITUTE, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('викидає помилку, якщо гравець не в цій команді', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        teamId: 't2',
      } as never);

      await expect(
        service.updatePlayerTeamRole('t1', 'p1', RosterRole.SUBSTITUTE, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('викидає помилку при спробі змінити роль на CAPTAIN або змінити роль капітану', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p1',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        teamId: 't1',
      } as never);

      await expect(
        service.updatePlayerTeamRole('t1', 'p1', RosterRole.SUBSTITUTE, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('успішно оновлює роль гравця', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p-capt',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        teamId: 't1',
        teamRole: 'PLAYER',
      } as never);

      await service.updatePlayerTeamRole(
        't1',
        'p1',
        RosterRole.SUBSTITUTE,
        user,
      );

      const updateCall = prisma.player.update.mock
        .calls[0][0] as Prisma.PlayerUpdateArgs;
      expect(updateCall.data.teamRole).toBe('SUBSTITUTE');
    });
  });

  describe('remove (disband)', () => {
    it('викидає помилку, якщо команди не існує', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('t1', user)).rejects.toThrow(
        NotFoundException,
      );
    });
    it('успішно дісбандить порожню команду (без гравців)', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      // Імітуємо порожній склад
      prisma.player.findMany.mockResolvedValueOnce([] as never);

      await service.remove('t1', user);

      // Не повинні створюватись трансфери LEAVE
      expect(prisma.teamTransfer.createMany.mock.calls.length).toBe(0);
    });

    it('успішно дісбандить команду', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);

      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
      prisma.player.findMany.mockResolvedValueOnce([
        { id: 'p1' },
        { id: 'p2' },
      ] as never);

      await service.remove('t1', user);

      expect(prisma.team.update.mock.calls[0][0]).toEqual({
        where: { id: 't1' },
        data: { status: 'DISBANDED' },
      });
      expect(prisma.player.updateMany.mock.calls.length).toBe(1);
    });
  });
});
