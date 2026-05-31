import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerStatsAggregatorService } from './player-stats-aggregator.service';
import { AccessPolicyService } from '../auth/access-policy.service';
import { StatsTransactionBuilder } from './stats-transaction.builder';
import { Stage, Bracket, Role } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('StatsService', () => {
  let service: StatsService;
  let prisma: DeepMockProxy<PrismaService>;
  let statsAggregator: MockProxy<PlayerStatsAggregatorService>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let builder: MockProxy<StatsTransactionBuilder>;

  const user: JwtPayload = {
    userId: 'u1',
    email: 'u1@mail.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    statsAggregator = mock<PlayerStatsAggregatorService>();
    accessPolicy = mock<AccessPolicyService>();
    builder = mock<StatsTransactionBuilder>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlayerStatsAggregatorService, useValue: statsAggregator },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: StatsTransactionBuilder, useValue: builder },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processTournamentStats', () => {
    it('викидає NotFoundException якщо турнір не знайдено', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce(null);
      await expect(service.processTournamentStats('t1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('повертає повідомлення якщо немає матчів для обробки', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        id: 't1',
        creatorId: 'u1',
        matches: [],
      } as never);

      const result = await service.processTournamentStats('t1', user);

      expect(accessPolicy.checkTournamentCreatorOrAdmin.mock.calls[0]).toEqual([
        'u1',
        user,
      ]);
      expect(result.processedMatches).toBe(0);
      expect(result.message).toContain(
        'Усі доступні матчі турніру вже оброблені.',
      );
    });

    it('ігнорує матчі без teamAId або teamBId', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        id: 't1',
        kFactor: 1,
        matches: [{ id: 'm1', teamAId: null, teamBId: 't-b' }],
      } as never);

      const result = await service.processTournamentStats('t1');
      expect(result.processedMatches).toBe(1);
      expect(prisma.team.findUnique.mock.calls.length).toBe(0);
    });

    it('викидає помилку якщо команда не знайдена в БД', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        id: 't1',
        kFactor: 1,
        matches: [{ id: 'm1', teamAId: 'team-bad', teamBId: 'team-b' }],
      } as never);
      prisma.team.findUnique.mockResolvedValueOnce(null);

      await expect(service.processTournamentStats('t1')).rejects.toThrow(
        'Команду team-bad не знайдено',
      );
    });

    it('успішно обробляє симульований матч (із stats.maps)', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        id: 't1',
        kFactor: 1,
        matches: [
          {
            id: 'm1',
            stage: Stage.PLAYOFF,
            bracket: Bracket.UPPER,
            teamAId: 'teamA',
            teamBId: 'teamB',
            scoreA: 2,
            scoreB: 1,
            stats: { maps: [{ mapName: 'Dust2' }] },
          },
        ],
      } as never);

      prisma.team.findUnique.mockResolvedValue({
        averageRating: 1500,
      } as never);
      prisma.player.findUnique.mockResolvedValue({
        rating: 1000,
        stats: {},
      } as never);

      builder.buildTeamMatchUpdates.mockReturnValue({
        isAWinner: true,
        teamA: { id: 'teamA', newRating: 1520, newTier: 'A' },
        teamB: { id: 'teamB', newRating: 1480, newTier: 'B' },
        historyA: { ratingChange: 20 },
        historyB: { ratingChange: -20 },
      } as unknown as ReturnType<typeof builder.buildTeamMatchUpdates>);

      builder.buildPlayerStatsUpdates.mockReturnValue({
        playerId: 'p1',
        newRating: 1020,
        newStatsJson: {},
        history: {},
      } as unknown as ReturnType<typeof builder.buildPlayerStatsUpdates>);

      statsAggregator.getSummedPlayerStatsForMatch.mockReturnValueOnce([
        { playerId: 'p1' } as unknown as ReturnType<
          typeof statsAggregator.getSummedPlayerStatsForMatch
        >[0],
      ]);
      statsAggregator.getSummedPlayerStatsForMatch.mockReturnValueOnce([]);

      const result = await service.processTournamentStats('t1');

      expect(result.processedMatches).toBe(1);
      expect(prisma.$transaction.mock.calls.length).toBeGreaterThan(0);

      expect(prisma.team.findUnique.mock.calls.length).toBe(2);
      expect(prisma.player.findUnique.mock.calls.length).toBe(2);
    });

    it('успішно обробляє ручний матч (перемога команди B) та ігнорує SUBSTITUTE', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        id: 't1',
        kFactor: 1,
        matches: [
          {
            id: 'm3',
            stage: Stage.PLAYOFF,
            bracket: Bracket.UPPER,
            teamAId: 'teamA',
            teamBId: 'teamB',
            scoreA: 0,
            scoreB: 1, // Перемогла команда B
            stats: null,
          },
        ],
      } as never);

      prisma.team.findUnique.mockResolvedValue({
        averageRating: 1500,
      } as never);
      prisma.player.findUnique.mockResolvedValue({
        rating: 1000,
        stats: {},
      } as never);

      builder.buildTeamMatchUpdates.mockReturnValue({
        isAWinner: false, // B - переможець
        teamA: { id: 'teamA', newRating: 1480, newTier: 'B' },
        teamB: { id: 'teamB', newRating: 1520, newTier: 'A' },
        historyA: { ratingChange: -20 },
        historyB: { ratingChange: 20 },
      } as unknown as ReturnType<typeof builder.buildTeamMatchUpdates>);

      builder.buildPlayerStatsUpdates.mockReturnValue({
        playerId: 'p4',
        newRating: 1020,
        newStatsJson: {},
        history: {},
      } as unknown as ReturnType<typeof builder.buildPlayerStatsUpdates>);

      prisma.tournamentRoster.findMany.mockResolvedValueOnce([
        { playerId: 'p4', role: 'PLAYER', participant: { teamId: 'teamB' } }, // Гравець команди B
        {
          playerId: 'p5',
          role: 'SUBSTITUTE',
          participant: { teamId: 'teamA' },
        }, // Заміна команди A
      ] as never);

      const result = await service.processTournamentStats('t1');

      expect(result.processedMatches).toBe(1);
      expect(builder.buildPlayerStatsUpdates.mock.calls.length).toBe(1);
      // Має викликатися для гравця p4 (команда B), і isWinner має бути true
      expect(builder.buildPlayerStatsUpdates.mock.calls[0]).toEqual([
        'm3',
        'p4',
        1000,
        20,
        {},
        { mapCount: 1 },
        true,
      ]);
    });

    it('успішно обробляє ручний матч (технічна поразка / без stats.maps)', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        id: 't1',
        kFactor: 1,
        matches: [
          {
            id: 'm2',
            stage: Stage.PLAYOFF,
            bracket: Bracket.UPPER,
            teamAId: 'teamA',
            teamBId: 'teamB',
            scoreA: 1,
            scoreB: 0,
            stats: null,
          },
        ],
      } as never);

      prisma.team.findUnique.mockResolvedValue({
        averageRating: 1500,
      } as never);
      prisma.player.findUnique.mockResolvedValue({
        rating: 1000,
        stats: {},
      } as never);

      builder.buildTeamMatchUpdates.mockReturnValue({
        isAWinner: true,
        teamA: { id: 'teamA', newRating: 1520, newTier: 'A' },
        teamB: { id: 'teamB', newRating: 1480, newTier: 'B' },
        historyA: { ratingChange: 20 },
        historyB: { ratingChange: -20 },
      } as unknown as ReturnType<typeof builder.buildTeamMatchUpdates>);

      builder.buildPlayerStatsUpdates.mockImplementation(
        (matchId, playerId) =>
          ({
            playerId,
            newRating: 1020,
            newStatsJson: {},
            history: {},
          }) as unknown as ReturnType<typeof builder.buildPlayerStatsUpdates>,
      );

      prisma.tournamentRoster.findMany.mockResolvedValueOnce([
        { playerId: 'p2', role: 'PLAYER', participant: { teamId: 'teamA' } },
        { playerId: 'p3', role: 'COACH', participant: { teamId: 'teamB' } },
        {
          playerId: 'p4',
          role: 'SUBSTITUTE',
          participant: { teamId: 'teamA' },
        }, // Щоб покрити гілку SUBSTITUTE
        { playerId: 'p5', role: 'PLAYER', participant: { teamId: 'teamB' } }, // Щоб покрити гілку isTeamA = false
      ] as never);

      const result = await service.processTournamentStats('t1');

      expect(result.processedMatches).toBe(1);
      // Має викликатися 2 рази: для гравця p2 (teamA) та p5 (teamB). COACH та SUBSTITUTE ігноруються.
      expect(builder.buildPlayerStatsUpdates.mock.calls.length).toBe(2);

      // Перевіряємо виклик для гравця A (переможець)
      expect(builder.buildPlayerStatsUpdates.mock.calls[0]).toEqual([
        'm2',
        'p2',
        1000,
        20,
        {},
        { mapCount: 1 },
        true,
      ]);
      // Перевіряємо виклик для гравця B (програвший)
      expect(builder.buildPlayerStatsUpdates.mock.calls[1]).toEqual([
        'm2',
        'p5',
        1000,
        -20,
        {},
        { mapCount: 1 },
        false,
      ]);
    });

    it('викидає помилку якщо гравець не знайдений', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({
        id: 't1',
        kFactor: 1,
        matches: [
          {
            id: 'm1',
            teamAId: 'teamA',
            teamBId: 'teamB',
            scoreA: 1,
            scoreB: 0,
            stats: { maps: [{}] },
          },
        ],
      } as never);

      prisma.team.findUnique.mockResolvedValue({
        averageRating: 1500,
      } as never);

      builder.buildTeamMatchUpdates.mockReturnValue({
        teamA: { id: 'teamA' },
        teamB: { id: 'teamB' },
        historyA: {},
        historyB: {},
      } as unknown as ReturnType<typeof builder.buildTeamMatchUpdates>);

      statsAggregator.getSummedPlayerStatsForMatch.mockReturnValueOnce([
        { playerId: 'p-bad' } as unknown as ReturnType<
          typeof statsAggregator.getSummedPlayerStatsForMatch
        >[0],
      ]);

      prisma.player.findUnique.mockResolvedValueOnce(null);

      await expect(service.processTournamentStats('t1')).rejects.toThrow(
        'Гравця p-bad не знайдено',
      );
    });
  });
});
