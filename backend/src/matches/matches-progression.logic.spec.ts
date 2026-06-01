import { MatchesProgressionLogic } from './matches-progression.logic';
import { Match, TournamentParticipant } from '@prisma/client';

describe('MatchesProgressionLogic', () => {
  let logic: MatchesProgressionLogic;

  beforeEach(() => {
    logic = new MatchesProgressionLogic();
  });

  it('calculates progression updates for winner and loser', () => {
    const match = {
      id: 'm1',
      teamAId: 'team-a',
      teamBId: 'team-b',
    } as Match;
    const nextWinnerMatch = {
      id: 'm2',
      teamAId: null,
      teamBId: 'team-c',
    } as Match;
    const nextLoserMatch = {
      id: 'm3',
      teamAId: 'team-d',
      teamBId: null,
    } as Match;

    const updates = logic.calculateProgressionUpdates(
      match,
      2,
      1,
      nextWinnerMatch,
      nextLoserMatch,
    );

    const currentUpdate = updates.find((u) => u.id === 'm1');
    expect(currentUpdate?.data).toMatchObject({
      scoreA: 2,
      scoreB: 1,
      isProcessed: true,
      matchStatus: 'COMPLETED',
    });

    const winnerUpdate = updates.find((u) => u.id === 'm2');
    expect(winnerUpdate?.data).toEqual({ teamAId: 'team-a' });

    const loserUpdate = updates.find((u) => u.id === 'm3');
    expect(loserUpdate?.data).toEqual({ teamBId: 'team-b' });
  });

  it('sorts group teams with head-to-head tie-breaker', () => {
    const teams = [
      { teamId: 'team-a', groupPoints: 3, mapsWon: 2, mapsLost: 1 },
      { teamId: 'team-b', groupPoints: 3, mapsWon: 2, mapsLost: 1 },
    ];
    const matches = [
      {
        teamAId: 'team-a',
        teamBId: 'team-b',
        scoreA: 2,
        scoreB: 0,
        isProcessed: true,
      },
    ];

    const sorted = logic.sortGroupTeams(teams, matches);

    expect(sorted[0].teamId).toBe('team-a');
    expect(sorted[1].teamId).toBe('team-b');
  });

  it('populates teamBId if teamAId is already taken', () => {
    const match = { id: 'm1', teamAId: 'team-a', teamBId: 'team-b' } as Match;
    const nextWinnerMatch = {
      id: 'm2',
      teamAId: 'existing-a',
      teamBId: null,
    } as Match;
    const nextLoserMatch = {
      id: 'm3',
      teamAId: 'existing-b',
      teamBId: null,
    } as Match;

    // (коли nextWinnerMatch.teamAId вже існує)
    const updates = logic.calculateProgressionUpdates(
      match,
      2,
      1,
      nextWinnerMatch,
      nextLoserMatch,
    );

    expect(updates.find((u) => u.id === 'm2')?.data.teamBId).toBe('team-a');
    expect(updates.find((u) => u.id === 'm3')?.data.teamBId).toBe('team-b');
  });

  it('tests complex head-to-head tie-breaker scenarios', () => {
    const teams = [
      { teamId: 'A', groupPoints: 3, mapsWon: 3, mapsLost: 2 },
      { teamId: 'B', groupPoints: 3, mapsWon: 4, mapsLost: 2 }, // У B краща загальна різниця
      { teamId: 'C', groupPoints: 3, mapsWon: 3, mapsLost: 2 },
    ];
    const matches = [
      { teamAId: 'A', teamBId: 'B', scoreA: 1, scoreB: 1, isProcessed: true },
      { teamAId: 'B', teamBId: 'C', scoreA: 1, scoreB: 1, isProcessed: true },
      { teamAId: 'C', teamBId: 'A', scoreA: 1, scoreB: 1, isProcessed: true },
      {
        teamAId: 'A',
        teamBId: 'UNKNOWN',
        scoreA: 1,
        scoreB: 1,
        isProcessed: true,
      },
    ];

    //  (вирішення через overallMapDiff та localeCompare)
    const sorted = logic.sortGroupTeams(teams, matches);

    expect(sorted.length).toBe(3);
    // B має бути першим через кращу загальну різницю карт
    expect(sorted[0].teamId).toBe('B');
  });
  it('sortGroupTeams skips matches involving external teams (Line 154)', () => {
    const teams = [
      { teamId: 'A', groupPoints: 3, mapsWon: 2, mapsLost: 0 },
      { teamId: 'B', groupPoints: 3, mapsWon: 2, mapsLost: 0 },
    ] as unknown as TournamentParticipant[];

    const matches = [
      { teamAId: 'A', teamBId: 'B', scoreA: 2, scoreB: 0, isProcessed: true },
      {
        teamAId: 'A',
        teamBId: 'EXTERNAL_TEAM',
        scoreA: 2,
        scoreB: 0,
        isProcessed: true,
      },
    ] as unknown as Match[];

    const sorted = logic.sortGroupTeams(teams, matches);
    expect(sorted[0].teamId).toBe('A');
  });

  it('sortGroupTeams covers all tie-breaker branches (Lines 168-180)', () => {
    // 1. Tie-breaker по H2H різниці карт
    let teams = [
      { teamId: 'A', groupPoints: 3, mapsWon: 5, mapsLost: 2 },
      { teamId: 'B', groupPoints: 3, mapsWon: 5, mapsLost: 2 },
    ] as unknown as TournamentParticipant[];
    let matches = [
      { teamAId: 'A', teamBId: 'B', scoreA: 2, scoreB: 0, isProcessed: true },
      { teamAId: 'B', teamBId: 'A', scoreA: 1, scoreB: 0, isProcessed: true },
    ] as unknown as Match[];
    let sorted = logic.sortGroupTeams(teams, matches);
    expect(sorted[0].teamId).toBe('A');

    // 2. Tie-breaker по H2H виграним картам
    teams = [
      { teamId: 'A', groupPoints: 3, mapsWon: 0, mapsLost: 0 },
      { teamId: 'B', groupPoints: 3, mapsWon: 0, mapsLost: 0 },
      { teamId: 'C', groupPoints: 3, mapsWon: 0, mapsLost: 0 },
    ] as unknown as TournamentParticipant[];
    matches = [
      { teamAId: 'A', teamBId: 'B', scoreA: 2, scoreB: 1, isProcessed: true },
      { teamAId: 'B', teamBId: 'C', scoreA: 3, scoreB: 2, isProcessed: true },
      { teamAId: 'C', teamBId: 'A', scoreA: 3, scoreB: 2, isProcessed: true },
    ] as unknown as Match[];
    sorted = logic.sortGroupTeams(teams, matches);
    expect(sorted[0].teamId).toBe('C');

    // 3. Tie-breaker по загальній різниці карт (overallMapDiff)
    teams = [
      { teamId: 'A', groupPoints: 3, mapsWon: 10, mapsLost: 5 },
      { teamId: 'B', groupPoints: 3, mapsWon: 8, mapsLost: 2 },
    ] as unknown as TournamentParticipant[];
    sorted = logic.sortGroupTeams(teams, []);
    expect(sorted[0].teamId).toBe('B');

    // 4. Tie-breaker по загальній кількості виграних карт
    teams = [
      { teamId: 'A', groupPoints: 3, mapsWon: 10, mapsLost: 5 },
      { teamId: 'B', groupPoints: 3, mapsWon: 12, mapsLost: 7 },
    ] as unknown as TournamentParticipant[];
    sorted = logic.sortGroupTeams(teams, []);
    expect(sorted[0].teamId).toBe('B');

    // 5. Алфавітне сортування (localeCompare)
    teams = [
      { teamId: 'Z', groupPoints: 3, mapsWon: 10, mapsLost: 5 },
      { teamId: 'A', groupPoints: 3, mapsWon: 10, mapsLost: 5 },
    ] as unknown as TournamentParticipant[];
    sorted = logic.sortGroupTeams(teams, []);
    expect(sorted[0].teamId).toBe('A');
  });
});
