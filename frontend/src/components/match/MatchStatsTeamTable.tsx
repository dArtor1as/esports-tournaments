import { Link } from 'react-router-dom';
import { Link as LinkIcon } from 'lucide-react';

interface MatchStatsTeamTableProps {
  team: any;
  playerStats: Record<string, any>;
  isCS2: boolean;
  showDamage: boolean;
}

export default function MatchStatsTeamTable({
  team,
  playerStats,
  isCS2,
  showDamage,
}: MatchStatsTeamTableProps) {
  if (!team || !team.players) return null;

  const playersWithStats = team.players
    .filter((p: any) => p.inGameRole !== 'COACH')
    .map((p: any) => ({ ...p, stat: playerStats[p.id] }))
    .filter((p: any) => p.stat)
    .sort((a: any, b: any) => (b.stat?.kills || 0) - (a.stat?.kills || 0));

  if (playersWithStats.length === 0) return null;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg mb-8">
      <div className="bg-slate-900 p-3 border-b border-slate-800">
        <Link
          to={`/team/${team.id}`}
          className="flex items-center gap-3 w-max group"
        >
          <div className="w-8 h-8 bg-slate-950 rounded border border-slate-700 flex items-center justify-center font-black text-white text-xs group-hover:border-amber-500 transition-colors">
            {team.tag}
          </div>
          <span className="font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
            {team.name}{' '}
            <LinkIcon
              size={12}
              className="text-slate-500 group-hover:text-amber-400"
            />
          </span>
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/50 border-b border-slate-800 font-black tracking-wider">
            <tr>
              <th className="px-4 py-3">Гравець</th>
              <th className="px-4 py-3 text-center border-l border-slate-800/50">
                K
              </th>
              <th className="px-4 py-3 text-center">D</th>
              <th className="px-4 py-3 text-center border-r border-slate-800/50">
                A
              </th>
              <th className="px-4 py-3 text-center">K/D</th>
              {showDamage && (
                <th className="px-4 py-3 text-center text-yellow-500/80">
                  DMG
                </th>
              )}
              {isCS2 ? (
                <>
                  <th className="px-4 py-3 text-center">ADR</th>
                  <th className="px-4 py-3 text-center">HS %</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-center">GPM</th>
                  <th className="px-4 py-3 text-center">XPM</th>
                  <th className="px-4 py-3 text-center">NW</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {playersWithStats.map((p: any) => {
              const pStat = p.stat;
              const kdRatio =
                pStat.deaths > 0
                  ? (pStat.kills / pStat.deaths).toFixed(2)
                  : (pStat.kills || 0).toFixed(2);
              return (
                <tr
                  key={p.id}
                  className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                    <span className="truncate max-w-[120px]">{p.nickname}</span>
                    {p.inGameRole && (
                      <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {p.inGameRole}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-white font-mono font-bold border-l border-slate-800/50 bg-slate-900/20">
                    {pStat.kills || 0}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400 font-mono font-bold bg-slate-900/20">
                    {pStat.deaths || 0}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400 font-mono font-bold border-r border-slate-800/50 bg-slate-900/20">
                    {pStat.assists || 0}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-black">
                    <span
                      className={
                        parseFloat(kdRatio) >= 1
                          ? 'text-emerald-500'
                          : 'text-slate-500'
                      }
                    >
                      {kdRatio}
                    </span>
                  </td>
                  {showDamage && (
                    <td className="px-4 py-3 text-center text-yellow-400 font-mono font-bold">
                      {pStat.damage || '-'}
                    </td>
                  )}
                  {isCS2 ? (
                    <>
                      <td className="px-4 py-3 text-center text-slate-300 font-mono">
                        {Math.round(pStat.adr || 0) || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400 font-mono">
                        {pStat.headshots
                          ? `${Math.round(pStat.headshots)}%`
                          : '-'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-center text-yellow-400 font-mono">
                        {Math.round(pStat.gpm || 0) || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-400 font-mono">
                        {Math.round(pStat.xpm || 0) || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-emerald-400 font-mono">
                        {pStat.netWorth
                          ? `${(pStat.netWorth / 1000).toFixed(1)}k`
                          : '-'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
