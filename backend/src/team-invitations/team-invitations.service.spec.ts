import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TeamInvitationsService } from './team-invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { TeamsService } from 'src/teams/teams.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { Role } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

jest.mock('common/helpers/tier.helper', () => ({
  TierHelper: {
    calculateTier: jest.fn().mockReturnValue('S'),
  },
}));

describe('TeamInvitationsService', () => {
  let service: TeamInvitationsService;
  let prisma: DeepMockProxy<PrismaService>;
  let mailService: MockProxy<MailService>;
  let teamsService: MockProxy<TeamsService>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let cacheManager: MockProxy<Cache>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'test@mail.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    mailService = mock<MailService>();
    teamsService = mock<TeamsService>();
    accessPolicy = mock<AccessPolicyService>();
    cacheManager = mock<Cache>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamInvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
        { provide: TeamsService, useValue: teamsService },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<TeamInvitationsService>(TeamInvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('викидає помилку, якщо команди немає', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create({ teamId: 't1', playerNickname: 'n' }, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('викидає помилку, якщо гравець не знайдений', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create({ teamId: 't1', playerNickname: 'n' }, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('створює інвайт та надсилає лист', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findFirst.mockResolvedValueOnce({ userId: 'u2' } as never);
      prisma.teamInvitation.findUnique.mockResolvedValueOnce(null);

      prisma.teamInvitation.upsert.mockResolvedValueOnce({
        id: 'inv1',
        team: { name: 'TeamA' },
        user: { email: 'u2@mail.com' },
      } as never);

      const result = await service.create(
        { teamId: 't1', playerNickname: 'n' },
        user,
      );

      expect(result.inviteId).toBe('inv1');
      expect(mailService.sendTeamInvite.mock.calls.length).toBe(1);
    });

    it('оновлює інвайт, якщо старий інвайт має статус відмінний від PENDING', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);
      prisma.player.findFirst.mockResolvedValueOnce({ userId: 'u2' } as never);

      prisma.teamInvitation.findUnique.mockResolvedValueOnce({
        id: 'old-invite',
        status: 'DECLINED',
      } as never);

      prisma.teamInvitation.upsert.mockResolvedValueOnce({
        id: 'inv2',
        team: { name: 'TeamA' },
        user: { email: 'u2@mail.com' },
      } as never);

      const result = await service.create(
        { teamId: 't1', playerNickname: 'n' },
        user,
      );

      expect(result.inviteId).toBe('inv2');
      expect(mailService.sendTeamInvite.mock.calls.length).toBe(1);
    });

    it('викидає помилку, якщо запрошення вже надіслано', async () => {
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captain: { userId: 'u1' },
      } as never);

      prisma.player.findFirst.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u2',
        teamId: null,
      } as never);

      prisma.teamInvitation.findUnique.mockResolvedValueOnce({
        id: 'existing-invite',
        status: 'PENDING',
      } as never);

      await expect(
        service.create({ teamId: 't1', playerNickname: 'n' }, user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('accept', () => {
    it('приймає інвайт, оновлює команду та очищає кеш', async () => {
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      prisma.teamInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv1',
        teamId: 't1',
        status: 'PENDING',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 100000),
        team: { game: { minTeamSize: 5 }, gameId: 'g1' },
      } as never);

      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        gameId: 'g1',
        teamId: null,
        rating: 1000,
      } as never);

      prisma.player.findMany.mockResolvedValueOnce(
        Array.from({ length: 4 }, () => ({
          rating: 1000,
          teamRole: 'PLAYER',
        })) as never,
      );

      await service.accept('token', 'p1', 'u1');

      // Чиста перевірка без toHaveBeenCalledWith (щоб лінтер був задоволений)
      expect(prisma.team.update.mock.calls[0]).toEqual([
        {
          where: { id: 't1' },
          data: {
            averageRating: 1000,
            tier: 'S',
            isComplete: true,
          },
        },
      ]);

      expect(cacheManager.del.mock.calls[0]).toEqual(['all_teams']);

      expect(prisma.teamInvitation.update.mock.calls[0]).toEqual([
        {
          where: { id: 'inv1' },
          data: { status: 'ACCEPTED' },
        },
      ]);
    });

    it('приймає інвайт, але залишає команду неукомплектованою (isComplete: false)', async () => {
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      prisma.teamInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv2',
        teamId: 't1',
        status: 'PENDING',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 100000),
        team: { game: { minTeamSize: 5 }, gameId: 'g1' },
      } as never);

      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p1',
        userId: 'u1',
        gameId: 'g1',
        teamId: null,
        rating: 1000,
      } as never);

      prisma.player.findMany.mockResolvedValueOnce([
        { rating: 1000, teamRole: 'CAPTAIN' },
      ] as never);

      await service.accept('token-2', 'p1', 'u1');

      expect(prisma.team.update.mock.calls[0]).toEqual([
        {
          where: { id: 't1' },
          data: { isComplete: false },
        },
      ]);
    });
  });

  describe('decline', () => {
    it('викидає помилку, якщо інвайт вже оброблено', async () => {
      prisma.teamInvitation.findUnique.mockResolvedValueOnce({
        status: 'ACCEPTED',
      } as never);
      await expect(service.decline('token', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успішно відхиляє інвайт', async () => {
      prisma.teamInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv1',
        status: 'PENDING',
        userId: 'u1',
      } as never);

      await service.decline('token', 'u1');

      expect(prisma.teamInvitation.update.mock.calls[0]).toEqual([
        {
          where: { id: 'inv1' },
          data: { status: 'DECLINED' },
        },
      ]);
    });

    it('викидає помилку, якщо користувач відхиляє чуже запрошення', async () => {
      prisma.teamInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv1',
        status: 'PENDING',
        userId: 'some-other-user',
      } as never);

      await expect(service.decline('token', 'u1')).rejects.toThrow();
    });
  });
});
