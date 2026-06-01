import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy, mock, MockProxy } from 'jest-mock-extended';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { InvitationPolicyService } from './invitation-policy.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { Region, Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TournamentInvitationsService', () => {
  let service: TournamentInvitationsService;
  let prisma: DeepMockProxy<PrismaService>;
  let mailService: MockProxy<MailService>;
  let invitationPolicy: MockProxy<InvitationPolicyService>;
  let accessPolicy: MockProxy<AccessPolicyService>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'test@mail.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    mailService = mock<MailService>();
    invitationPolicy = mock<InvitationPolicyService>();
    accessPolicy = mock<AccessPolicyService>();

    prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentInvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
        { provide: InvitationPolicyService, useValue: invitationPolicy },
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    service = module.get<TournamentInvitationsService>(
      TournamentInvitationsService,
    );
  });

  describe('create', () => {
    it('викидає помилку, якщо турнір або команда відсутні', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create({ tournamentId: 't1', teamId: 'tm1' }, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('викидає помилку, якщо gameId не збігається', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        gameId: 'g1',
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce({ gameId: 'g2' } as never);

      await expect(
        service.create({ tournamentId: 't1', teamId: 'tm1' }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('успішно створює інвайт та відправляє лист', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        gameId: 'g1',
        region: Region.GLOBAL,
        tier: 2,
        maxParticipants: 16,
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce({
        gameId: 'g1',
        region: Region.EU,
        tier: 2,
      } as never);

      prisma.tournamentParticipant.count.mockResolvedValueOnce(5);
      prisma.tournamentInvitation.count.mockResolvedValueOnce(2);

      prisma.tournamentParticipant.findUnique.mockResolvedValueOnce(null);
      prisma.tournamentInvitation.findFirst.mockResolvedValueOnce(null);

      prisma.tournamentInvitation.create.mockResolvedValueOnce({
        id: 'inv1',
        team: { name: 'A', captain: { user: { email: 'cap@mail.com' } } },
        tournament: { title: 'T1' },
      } as never);

      const result = await service.create(
        { tournamentId: 't1', teamId: 'tm1' },
        user,
      );

      // ВИПРАВЛЕНО: mock.calls
      expect(invitationPolicy.checkRegionRestriction.mock.calls.length).toBe(1);
      expect(invitationPolicy.checkTierDifference.mock.calls.length).toBe(1);
      expect(invitationPolicy.checkCapacity.mock.calls[0]).toEqual([5, 2, 16]);
      expect(mailService.sendTournamentInvite.mock.calls.length).toBe(1);
      expect(result).toHaveProperty('inviteId', 'inv1');
    });
  });

  describe('accept', () => {
    it('викидає помилку, якщо інвайт не валідний', async () => {
      prisma.tournamentInvitation.findUnique.mockResolvedValueOnce(null);
      await expect(service.accept('token', {} as never, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успішно приймає інвайт', async () => {
      prisma.tournamentInvitation.findUnique.mockResolvedValueOnce({
        status: 'PENDING',
        tournamentId: 't1',
        teamId: 'tm1',
        id: 'inv1',
        // ВИПРАВЛЕНО: масив з унікальними ID гравців (щоб логіка їх знайшла)
        team: {
          captainId: 'p1',
          captain: { userId: 'u1' },
          players: [
            { id: 'p1' },
            { id: 'p2' },
            { id: 'p3' },
            { id: 'p4' },
            { id: 'p5' },
          ],
        },
        tournament: { settings: {} },
      } as never);

      prisma.tournamentParticipant.create.mockResolvedValueOnce({
        id: 'part1',
      } as never);

      await service.accept(
        'token',
        { rosterPlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'] } as never,
        user,
      );

      // ВИПРАВЛЕНО: mock.calls
      expect(prisma.tournamentRoster.createMany.mock.calls.length).toBe(1);
      expect(prisma.tournamentInvitation.update.mock.calls[0][0]).toEqual({
        where: { id: 'inv1' },
        data: { status: 'ACCEPTED' },
      });
    });
  });

  describe('decline', () => {
    it('викидає помилку, якщо інвайт не знайдено', async () => {
      prisma.tournamentInvitation.findUnique.mockResolvedValueOnce(null);
      await expect(service.decline('token', user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('успішно відхиляє', async () => {
      prisma.tournamentInvitation.findUnique.mockResolvedValueOnce({
        id: 'inv1',
        status: 'PENDING',
        team: { captain: { userId: 'u1' } },
      } as never);

      await service.decline('token', user);

      // ВИПРАВЛЕНО: mock.calls
      expect(prisma.tournamentInvitation.update.mock.calls[0][0]).toEqual({
        where: { id: 'inv1' },
        data: { status: 'DECLINED' },
      });
    });
  });
});
