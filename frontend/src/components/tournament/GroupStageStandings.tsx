import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GroupStageStandingsProps {
  matches: any[];
  pointsPerWin?: number;
}

export default function GroupStageStandings({
  matches,
  pointsPerWin = 3,
}: GroupStageStandingsProps) {
  // Агрегація матчів у групи та підрахунок очок
  const groupsData = useMemo(() => {
    const groups: Record<
      string,
      { teams: Record<string, any>; matches: any[] }
    > = {};

    matches.forEach((m) => {
      const gName = m.groupName || 'Group';
      if (!groups[gName]) groups[gName] = { teams: {}, matches: [] };
      groups[gName].matches.push(m);

      // Ініціалізація команд
      if (m.teamAId && !groups[gName].teams[m.teamAId]) {
        groups[gName].teams[m.teamAId] = {
          id: m.teamAId,
          team: m.teamA,
          w: 0,
          l: 0,
          pts: 0,
        };
      }
      if (m.teamBId && !groups[gName].teams[m.teamBId]) {
        groups[gName].teams[m.teamBId] = {
          id: m.teamBId,
          team: m.teamB,
          w: 0,
          l: 0,
          pts: 0,
        };
      }

      // Нарахування очок за зіграні матчі
      const isPlayed =
        m.matchStatus === 'COMPLETED' || m.scoreA > 0 || m.scoreB > 0;
      if (isPlayed && m.teamAId && m.teamBId) {
        if (m.scoreA > m.scoreB) {
          groups[gName].teams[m.teamAId].w += 1;
          groups[gName].teams[m.teamAId].pts += pointsPerWin;
          groups[gName].teams[m.teamBId].l += 1;
        } else if (m.scoreB > m.scoreA) {
          groups[gName].teams[m.teamBId].w += 1;
          groups[gName].teams[m.teamBId].pts += pointsPerWin;
          groups[gName].teams[m.teamAId].l += 1;
        }
      }
    });

    // Сортування команд усередині груп (За очками -> Перемогами -> Поразками)
    Object.keys(groups).forEach((gName) => {
      const teamsArr = Object.values(groups[gName].teams);
      teamsArr.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.w !== a.w) return b.w - a.w;
        return a.l - b.l;
      });
      groups[gName].teams = teamsArr as any;
    });

    return groups;
  }, [matches, pointsPerWin]);

  if (Object.keys(groupsData).length === 0) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {Object.entries(groupsData)
        .sort()
        .map(([groupName, group]) => (
          <div
            key={groupName}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl grid grid-cols-1 xl:grid-cols-12"
          >
            {/* ЛІВА ПАНЕЛЬ: STANDINGS (ТАБЛИЦЯ) */}
            <div className="xl:col-span-7 bg-slate-950/50 p-6 flex flex-col justify-center">
              <h3 className="text-lg font-black text-amber-500 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <Trophy size={18} /> {groupName}
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/80 border-y border-slate-800 font-black tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Rank</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3 text-center bg-slate-900/50 border-l border-slate-800">
                        PTS
                      </th>
                      <th className="px-4 py-3 text-center text-emerald-500/70">
                        W
                      </th>
                      <th className="px-4 py-3 text-center text-red-500/70">
                        L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(group.teams as any[]).map((t, idx) => (
                      <tr
                        key={t.id}
                        className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-center font-black text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/team/${t.id}`}
                            className="flex items-center gap-2 font-bold text-white hover:text-amber-400 transition-colors group"
                          >
                            <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 group-hover:border-amber-500/50 transition-colors">
                              {t.team?.tag}
                            </span>
                            <span className="truncate max-w-[150px]">
                              {t.team?.name || 'Unknown'}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-black text-amber-400 bg-slate-900/30 border-l border-slate-800 text-base">
                          {t.pts}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                          {t.w}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-red-400">
                          {t.l}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ПРАВА ПАНЕЛЬ: СПИСОК МАТЧІВ ГРУПИ */}
            <div className="xl:col-span-5 bg-slate-900 border-t xl:border-t-0 xl:border-l border-slate-800 p-6 flex flex-col justify-center">
              <h4 className="text-xs font-black text-slate-500 mb-4 uppercase tracking-widest">
                Матчі групи
              </h4>
              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {group.matches.map((m) => {
                  const isPlayed =
                    m.matchStatus === 'COMPLETED' ||
                    m.scoreA > 0 ||
                    m.scoreB > 0;
                  const aWin = m.scoreA > m.scoreB;
                  const bWin = m.scoreB > m.scoreA;

                  return (
                    <Link
                      to={`/match/${m.id}`}
                      key={m.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 hover:border-amber-500/50 transition-colors group"
                    >
                      {/* Team A */}
                      <div
                        className={`flex items-center gap-2 w-2/5 ${isPlayed && !aWin ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`truncate text-xs font-bold ${aWin ? 'text-emerald-400' : 'text-white group-hover:text-amber-400'}`}
                        >
                          {m.teamA?.name || 'TBD'}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="flex items-center justify-center gap-2 w-1/5 font-mono font-black text-sm">
                        {isPlayed ? (
                          <>
                            <span
                              className={
                                aWin ? 'text-emerald-400' : 'text-slate-400'
                              }
                            >
                              {m.scoreA}
                            </span>
                            <span className="text-slate-600">:</span>
                            <span
                              className={
                                bWin ? 'text-emerald-400' : 'text-slate-400'
                              }
                            >
                              {m.scoreB}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500 text-[10px] uppercase">
                            vs
                          </span>
                        )}
                      </div>

                      {/* Team B */}
                      <div
                        className={`flex items-center justify-end gap-2 w-2/5 ${isPlayed && !bWin ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`truncate text-xs font-bold text-right ${bWin ? 'text-emerald-400' : 'text-white group-hover:text-amber-400'}`}
                        >
                          {m.teamB?.name || 'TBD'}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
