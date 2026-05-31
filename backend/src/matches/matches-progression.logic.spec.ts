import { MatchesProgressionLogic } from './matches-progression.logic';
import { Match } from '@prisma/client';

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
});
