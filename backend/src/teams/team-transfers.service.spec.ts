import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { mockDeep, DeepMockProxy, mock, MockProxy } from 'jest-mock-extended';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TeamTransfersService } from './team-transfers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from '../auth/access-policy.service';
import { Role } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('TeamTransfersService', () => {
  let service: TeamTransfersService;
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
        TeamTransfersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<TeamTransfersService>(TeamTransfersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('leaveTeam', () => {
    it('викидає помилку, якщо команди або гравця не існує', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      prisma.player.findUnique.mockResolvedValueOnce(null);
      await expect(service.leaveTeam('t1', 'p1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('забороняє виходити за іншого гравця', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({ id: 't1' } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'other-user',
      } as never);
      await expect(service.leaveTeam('t1', 'p1', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('викидає помилку, якщо гравець не в цій команді', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({ id: 't1' } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        teamId: 't2',
      } as never);
      await expect(service.leaveTeam('t1', 'p1', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('не дає капітану покинути команду, якщо він не один', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p1',
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        teamId: 't1',
      } as never);
      prisma.player.count.mockResolvedValueOnce(3);

      await expect(service.leaveTeam('t1', 'p1', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успішно виходить з команди', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p2',
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        teamId: 't1',
      } as never);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      await service.leaveTeam('t1', 'p1', user);

      expect(prisma.player.update.mock.calls.length).toBe(1);
      expect(prisma.teamTransfer.create.mock.calls.length).toBe(1);
      expect(prisma.team.update.mock.calls[0]).toEqual([
        { where: { id: 't1' }, data: { isComplete: false } },
      ]);
    });
  });

  describe('kickPlayer', () => {
    it('викидає помилку, якщо команди або гравця не існує', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      prisma.player.findUnique.mockResolvedValueOnce(null);
      await expect(service.kickPlayer('t1', 'p1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('викидає помилку, якщо гравець не в цій команді', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({ id: 't1' } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u2',
        teamId: 't2', // Гравець в іншій команді
      } as never);
      await expect(service.kickPlayer('t1', 'p1', user)).rejects.toThrow(
        BadRequestException,
      );
    });
    it('викидає помилку, якщо капітан кікає сам себе', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p1',
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        teamId: 't1',
      } as never);

      await expect(service.kickPlayer('t1', 'p1', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успішно кікає гравця', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p-captain',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        teamId: 't1',
      } as never);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      await service.kickPlayer('t1', 'p1', user);

      expect(prisma.teamTransfer.create.mock.calls[0]).toEqual([
        { data: { playerId: 'p1', teamId: 't1', type: 'KICK' } },
      ]);
    });
  });

  describe('transferLeadership', () => {
    it('викидає помилку, якщо команду не знайдено', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.transferLeadership('t1', 'p1', user),
      ).rejects.toThrow(NotFoundException);
    });
    it('викидає помилку, якщо новий капітан не знайдений або не в цій команді', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p-old',
        captain: { userId: 'u1' },
      } as never);

      // Імітуємо, що нового гравця знайшли, але він в іншій команді (або null)
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p-new',
        teamId: 't2', // Невідповідність teamId
      } as never);

      await expect(
        service.transferLeadership('t1', 'p-new', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('викидає помилку, якщо гравець вже є капітаном', async () => {
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
        service.transferLeadership('t1', 'p1', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('успішно передає лідерство', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p-old',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p-new',
        teamId: 't1',
      } as never);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      await service.transferLeadership('t1', 'p-new', user);

      // Використовуємо .update замість .updateMany
      expect(prisma.player.update.mock.calls.length).toBeGreaterThan(0);
      expect(prisma.team.update.mock.calls[0]).toEqual([
        { where: { id: 't1' }, data: { captainId: 'p-new' } },
      ]);
    });
  });

  describe('getTeamTransfers', () => {
    it('повертає історію трансферів', async () => {
      prisma.teamTransfer.findMany.mockResolvedValueOnce([
        { id: 'tr1' },
      ] as never);
      const result = await service.getTeamTransfers('t1');
      expect(result).toEqual([{ id: 'tr1' }]);
    });
  });
  describe('getPlayerTransfers', () => {
    it('повертає історію трансферів гравця', async () => {
      prisma.teamTransfer.findMany.mockResolvedValueOnce([
        { id: 'tr1' },
      ] as never);
      const result = await service.getPlayerTransfers('p1');
      expect(result).toEqual([{ id: 'tr1' }]);
    });
  });
});
