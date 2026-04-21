import type { TournamentMatch } from '../../types/tournament';

type GroupTableRow = {
  teamId: string;
  teamName: string;
  points: number;
  matchDiff: number;
  mapDiff: number;
  wins: number;
  losses: number;
};

function buildGroupRows(matches: TournamentMatch[]): Record<string, GroupTableRow[]> {
  const byGroup = new Map<string, Map<string, GroupTableRow>>();

  for (const match of matches) {
    if (match.stage !== 'GROUP' || !match.groupName || !match.teamA || !match.teamB) {
      continue;
    }

    const groupName = match.groupName;
    if (!byGroup.has(groupName)) {
      byGroup.set(groupName, new Map<string, GroupTableRow>());
    }

    const group = byGroup.get(groupName)!;
    const teamAKey = match.teamA.id;
    const teamBKey = match.teamB.id;

    if (!group.has(teamAKey)) {
      group.set(teamAKey, {
        teamId: teamAKey,
        teamName: match.teamA.tag || match.teamA.name,
        points: 0,
        matchDiff: 0,
        mapDiff: 0,
        wins: 0,
        losses: 0,
      });
    }
    if (!group.has(teamBKey)) {
      group.set(teamBKey, {
        teamId: teamBKey,
        teamName: match.teamB.tag || match.teamB.name,
        points: 0,
        matchDiff: 0,
        mapDiff: 0,
        wins: 0,
        losses: 0,
      });
    }

    const rowA = group.get(teamAKey)!;
    const rowB = group.get(teamBKey)!;

    rowA.mapDiff += match.scoreA - match.scoreB;
    rowB.mapDiff += match.scoreB - match.scoreA;

    if (match.scoreA > match.scoreB) {
      rowA.points += 3;
      rowA.wins += 1;
      rowA.matchDiff += 1;
      rowB.losses += 1;
      rowB.matchDiff -= 1;
    } else if (match.scoreB > match.scoreA) {
      rowB.points += 3;
      rowB.wins += 1;
      rowB.matchDiff += 1;
      rowA.losses += 1;
      rowA.matchDiff -= 1;
    }
  }

  const result: Record<string, GroupTableRow[]> = {};
  for (const [groupName, rows] of byGroup.entries()) {
    result[groupName] = [...rows.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.matchDiff !== a.matchDiff) return b.matchDiff - a.matchDiff;
      return b.mapDiff - a.mapDiff;
    });
  }

  return result;
}

type Props = {
  matches: TournamentMatch[];
};

export function GroupTables({ matches }: Props) {
  const grouped = buildGroupRows(matches);
  const groupNames = Object.keys(grouped).sort();

  if (groupNames.length === 0) {
    return (
      <div className="card">
        <h3>Group stage</h3>
        <p>Матчі групового етапу відсутні.</p>
      </div>
    );
  }

  return (
    <section className="card">
      <h3>Таблиці груп</h3>
      <div className="groups-grid">
        {groupNames.map((name) => (
          <article key={name} className="group-card">
            <h4>{name}</h4>
            <table>
              <thead>
                <tr>
                  <th>Команда</th>
                  <th>Очки</th>
                  <th>W-L</th>
                  <th>Δ Match</th>
                  <th>Δ Map</th>
                </tr>
              </thead>
              <tbody>
                {grouped[name].map((row) => (
                  <tr key={row.teamId}>
                    <td>{row.teamName}</td>
                    <td>{row.points}</td>
                    <td>
                      {row.wins}-{row.losses}
                    </td>
                    <td>{row.matchDiff}</td>
                    <td>{row.mapDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </section>
  );
}
