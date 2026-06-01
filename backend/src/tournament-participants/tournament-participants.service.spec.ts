import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy, mock, MockProxy } from 'jest-mock-extended';
import { TournamentParticipantsService } from './tournament-participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { InvitationPolicyService } from 'src/tournament-invitations/invitation-policy.service';
import { Region, Role, Prisma } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('TournamentParticipantsService', () => {
  let service: TournamentParticipantsService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let invitationPolicy: MockProxy<InvitationPolicyService>;

  const user: JwtPayload = {
    userId: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
  };

  const dto = {
    tournamentId: 't1',
    teamId: 'team1',
    rosterPlayerIds: ['p1', 'p2'],
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mock<AccessPolicyService>();
    invitationPolicy = mock<InvitationPolicyService>();

    // Мокаємо транзакцію так, щоб вона виконувала переданий колбек
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentParticipantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: InvitationPolicyService, useValue: invitationPolicy },
      ],
    }).compile();

    service = module.get<TournamentParticipantsService>(
      TournamentParticipantsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('викидає NotFoundException, якщо турніру не існує', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(dto, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('викидає BadRequestException, якщо турнір не planned', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'live',
        _count: { participants: 0 },
      } as never);

      await expect(service.create(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('викидає BadRequestException, якщо немає вільних місць', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'planned',
        maxParticipants: 16,
        _count: { participants: 16 }, // Місць більше немає
      } as never);

      await expect(service.create(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('викидає NotFoundException, якщо команду не знайдено', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'planned',
        maxParticipants: 16,
        _count: { participants: 0 },
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(dto, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('викидає BadRequestException, якщо ігрова дисципліна не збігається', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'planned',
        gameId: 'game-1',
        maxParticipants: 16,
        _count: { participants: 0 },
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce({
        gameId: 'game-2', // Інша гра
      } as never);

      await expect(service.create(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('викидає BadRequestException при розбіжності регіонів (якщо турнір не GLOBAL)', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'planned',
        gameId: 'game-1',
        region: Region.EU, // Турнір EU
        maxParticipants: 16,
        _count: { participants: 0 },
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce({
        gameId: 'game-1',
        region: Region.NA, // Команда NA
      } as never);

      await expect(service.create(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('викидає ConflictException, якщо команда вже зареєстрована', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'planned',
        gameId: 'game-1',
        region: Region.GLOBAL,
        maxParticipants: 16,
        _count: { participants: 0 },
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce({
        gameId: 'game-1',
        region: Region.EU,
        tier: 1,
        captain: { userId: 'u1' },
      } as never);

      // Імітуємо, що запис учасника вже є
      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce({
        id: 'existing-part',
      } as never);

      await expect(service.create(dto, user)).rejects.toThrow(
        ConflictException,
      );
    });

    it('викидає BadRequestException, якщо гравці не знайдені або не в команді', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'planned',
        gameId: 'game-1',
        region: Region.GLOBAL,
        maxParticipants: 16,
        _count: { participants: 0 },
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce({
        gameId: 'game-1',
        region: Region.EU,
        tier: 1,
        captain: { userId: 'u1' },
      } as never);
      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce(null);

      // В dto.rosterPlayerIds 2 гравці, але з бази повернувся лише 1
      prisma.player.findMany.mockResolvedValueOnce([{ id: 'p1' }] as never);

      await expect(service.create(dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успішно створює учасника та ростер', async () => {
      // 1. Пошук турніру
      prisma.tournament.findUnique.mockResolvedValueOnce({
        status: 'planned',
        gameId: 'game-1',
        region: Region.GLOBAL,
        tier: 1,
        maxParticipants: 16,
        _count: { participants: 5 },
      } as never);

      // 2. Пошук команди
      prisma.team.findUnique.mockResolvedValueOnce({
        gameId: 'game-1',
        region: Region.NA,
        tier: 1,
        captain: { userId: 'u1' },
      } as never);

      // 3. Перевірка дублікату учасника
      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce(null);

      // 4. Пошук гравців
      prisma.player.findMany.mockResolvedValueOnce([
        { id: 'p1' },
        { id: 'p2' },
      ] as never);

      // 5. Моки для транзакції
      prisma.tournamentParticipant.create.mockResolvedValueOnce({
        id: 'new-participant-id',
      } as never);
      // Останній findUnique (який повертає фінальний результат у транзакції)
      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce({
        id: 'new-participant-id',
        tournamentRosters: [],
      } as never);

      const result = await service.create(dto, user);

      // Перевіряємо виклики
      expect(invitationPolicy.checkTierDifference.mock.calls.length).toBe(1);
      expect(accessPolicy.checkCaptainOrAdmin.mock.calls.length).toBe(1);

      // Перевіряємо створення учасника
      const createParticipantCall = prisma.tournamentParticipant.create.mock
        .calls[0][0] as Prisma.TournamentParticipantCreateArgs;
      expect(createParticipantCall.data.seed).toBe(6); // 5 існуючих + 1

      // Перевіряємо створення ростеру
      const createRosterCall = prisma.tournamentRoster.createMany.mock
        .calls[0][0] as Prisma.TournamentRosterCreateManyArgs;
      expect(Array.isArray(createRosterCall.data)).toBe(true);

      expect(result).toHaveProperty('id', 'new-participant-id');
    });
  });

  describe('findAllByTournament', () => {
    it('повертає список учасників турніру', async () => {
      prisma.tournamentParticipant.findMany.mockResolvedValueOnce([
        { id: 'part1' },
      ] as never);

      const result = await service.findAllByTournament('t1');

      expect(
        prisma.tournamentParticipant.findMany.mock.calls[0][0],
      ).toMatchObject({
        where: { tournamentId: 't1' },
      });
      expect(result).toEqual([{ id: 'part1' }]);
    });
  });

  describe('remove', () => {
    it('викидає NotFoundException, якщо учасника не знайдено', async () => {
      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('part-1', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('викидає BadRequestException, якщо турнір вже почався', async () => {
      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce({
        tournament: { status: 'live', creatorId: 'admin' },
        team: { captain: { userId: 'cap-1' } },
      } as never);

      await expect(service.remove('part-1', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успішно видаляє учасника та його ростер', async () => {
      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce({
        tournament: { status: 'planned', creatorId: 'admin' },
        team: { captain: { userId: 'cap-1' } },
      } as never);

      prisma.tournamentParticipant.delete.mockResolvedValueOnce({
        id: 'part-1',
      } as never);

      const result = await service.remove('part-1', user);

      // Перевіряємо доступ
      expect(
        accessPolicy.checkTeamCaptainOrTournamentCreatorOrAdmin.mock.calls
          .length,
      ).toBe(1);

      // Перевіряємо видалення ростерів
      expect(prisma.tournamentRoster.deleteMany.mock.calls[0][0]).toEqual({
        where: { participantId: 'part-1' },
      });

      // Перевіряємо видалення самого запису
      expect(prisma.tournamentParticipant.delete.mock.calls[0][0]).toEqual({
        where: { id: 'part-1' },
      });

      expect(result).toHaveProperty('id', 'part-1');
    });
  });
});
