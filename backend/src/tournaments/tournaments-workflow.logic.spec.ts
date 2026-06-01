import { BadRequestException } from '@nestjs/common';
import { RosterRole, Stage, TournamentFormat } from '@prisma/client';
import { BracketType } from './dto/create-tournament.dto';
import {
  TournamentsWorkflowLogic,
  TeamWithPlayers,
  TournamentWorkflowView,
} from './tournaments-workflow.logic';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';

describe('TournamentsWorkflowLogic', () => {
  const buildTeams = (count: number): TeamWithPlayers[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `team-${i}`,
      name: `Team ${i}`,
      tag: `T${i}`,
      gameId: 'game-1',
      tier: 1,
      region: 'GLOBAL',
      countryCode: 'INT',
      logoUrl: null,
      averageRating: 1000,
      isManualCountry: false,
      isComplete: true,
      status: 'ACTIVE',
      captainId: `p-${i}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      players: [
        {
          id: `p-${i}`,
          userId: `u-${i}`,
          teamId: `team-${i}`,
          gameId: 'game-1',
          nickname: 'cap',
          inGameRole: 'ENTRY',
          rating: 1000,
          teamRole: RosterRole.CAPTAIN,
          stats: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: `p-coach-${i}`,
          userId: `u-coach-${i}`,
          teamId: `team-${i}`,
          gameId: 'game-1',
          nickname: 'coach',
          inGameRole: 'COACH',
          rating: 1000,
          teamRole: RosterRole.COACH,
          stats: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: `p-sub-${i}`,
          userId: `u-sub-${i}`,
          teamId: `team-${i}`,
          gameId: 'game-1',
          nickname: 'sub',
          inGameRole: 'ENTRY',
          rating: 1000,
          teamRole: RosterRole.SUBSTITUTE,
          stats: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    }));

  describe('buildTestTournamentPayload', () => {
    it('throws for invalid team count', () => {
      expect(() =>
        TournamentsWorkflowLogic.buildTestTournamentPayload(
          { teamCount: 12, isPublic: true, title: 'Test' },
          'user-1',
          'game-1',
          buildTeams(16),
        ),
      ).toThrow(BadRequestException);
    });

    it('throws when teams are insufficient', () => {
      expect(() =>
        TournamentsWorkflowLogic.buildTestTournamentPayload(
          { teamCount: 16, isPublic: true, title: 'Test' }, // ВИПРАВЛЕНО: Додано title
          'user-1',
          'game-1',
          buildTeams(8),
        ),
      ).toThrow(BadRequestException);
    });

    it('builds a valid tournament payload', () => {
      const payload = TournamentsWorkflowLogic.buildTestTournamentPayload(
        {
          teamCount: 8,
          isPublic: true,
          bracketType: BracketType.DOUBLE_ELIMINATION,
          title: 'Test Cup',
        },
        'user-1',
        'game-1',
        buildTeams(8),
      );

      expect(payload.title).toBe('Test Cup');
      expect(payload.game).toEqual({ connect: { id: 'game-1' } });
      expect(payload.creator).toEqual({ connect: { id: 'user-1' } });
      expect(payload.format).toBe('TEAM');
      expect(payload.maxParticipants).toBe(8);
      expect(payload.participants?.create).toHaveLength(8);
    });
  });

  describe('formatWorkflowView', () => {
    const mockTournaments = [
      {
        id: 't1',
        title: 'Cup 1',
        status: 'planned',
        format: 'TEAM' as TournamentFormat,
        game: { name: 'CS2' },
        _count: { participants: 8, matches: 0 },
        gameId: 'g1',
        tier: 1,
        region: 'GLOBAL',
        countryCode: 'INT',
        kFactor: 1,
        maxParticipants: 16,
        settings: {},
        creatorId: 'u1',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 't2',
        title: 'Cup 2',
        status: 'live',
        format: 'TEAM' as TournamentFormat,
        game: { name: 'CS2' },
        _count: { participants: 16, matches: 24 },
        gameId: 'g1',
        tier: 1,
        region: 'GLOBAL',
        countryCode: 'INT',
        kFactor: 1,
        maxParticipants: 16,
        settings: {},
        creatorId: 'u1',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockCounts = [
      { tournamentId: 't2', stage: Stage.GROUP, _count: { _all: 24 } },
    ];

    it('formats workflow view and applies generation filter', () => {
      const result = TournamentsWorkflowLogic.formatWorkflowView(
        mockTournaments as unknown as TournamentWorkflowView[],
        mockCounts,
        'generation',
      );

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.id === 't1')?.canGenerateBracket).toBe(true);
      expect(
        result.find((r) => r.id === 't2')?.requiresTransitionToPlayoffs,
      ).toBe(true);
    });

    it('returns all tournaments when no workflow filter is applied', () => {
      const result = TournamentsWorkflowLogic.formatWorkflowView(
        mockTournaments as unknown as TournamentWorkflowView[],
        mockCounts,
      );

      expect(result).toHaveLength(2); // Має повернути всі без фільтрації
    });

    it('formats workflow view and applies simulation filter', () => {
      const result = TournamentsWorkflowLogic.formatWorkflowView(
        mockTournaments as unknown as TournamentWorkflowView[],
        mockCounts,
        'simulation',
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t2');
      expect(result[0].hasGeneratedGrid).toBe(true);
    });
  });
  it('builds payload with default teamCount, default title, and tier 2', () => {
    const payload = TournamentsWorkflowLogic.buildTestTournamentPayload(
      { isPublic: true, tier: 2 } as unknown as GenerateTestTournamentDto,
      'user-1',
      'game-1',
      buildTeams(16),
    );

    expect(payload.maxParticipants).toBe(16);
    expect(payload.title).toMatch(/Custom Cup #\d+/);
    expect(payload.kFactor).toBe(0.6);
  });

  it('builds payload with ROUND_ROBIN and default groupCount', () => {
    const payload = TournamentsWorkflowLogic.buildTestTournamentPayload(
      {
        isPublic: true,
        bracketType: BracketType.ROUND_ROBIN,
        title: 'RR',
      } as unknown as GenerateTestTournamentDto,
      'user-1',
      'game-1',
      buildTeams(16),
    );

    const settings = payload.settings as { groupCount: number };
    expect(settings.groupCount).toBe(2);
  });

  it('builds payload with ROUND_ROBIN and custom groupCount', () => {
    const payload = TournamentsWorkflowLogic.buildTestTournamentPayload(
      {
        isPublic: true,
        bracketType: BracketType.ROUND_ROBIN,
        title: 'RR',
        groupCount: 4,
      } as unknown as GenerateTestTournamentDto,
      'user-1',
      'game-1',
      buildTeams(16),
    );

    const settings = payload.settings as { groupCount: number };
    expect(settings.groupCount).toBe(4);
  });
});
