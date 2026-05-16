import {
  Target,
  Swords,
  Shield,
  Skull,
  Activity,
  Crosshair,
} from "lucide-react";
import StatBar from "./StatBar";
import {
  getWinRateStatus,
  getCS2FieldStatus,
  getDotaFieldStatus,
} from "@/lib/stat-rules";

interface PlayerStatsPanelProps {
  stats: any;
  hasStats: boolean;
  isCS2: boolean;
}

export default function PlayerStatsPanel({
  stats,
  hasStats,
  isCS2,
}: PlayerStatsPanelProps) {
  if (!hasStats) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl min-h-[346px] flex flex-col items-center justify-center">
        <Target size={48} className="text-slate-800 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">
          Немає даних аналітики
        </h3>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl min-h-[346px]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-10">
        <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
          <span className="text-slate-400 text-xs font-bold uppercase mb-1">
            Win Rate
          </span>
          <span className="text-3xl font-black text-white">
            {stats.winRate}%
          </span>
          <StatBar
            label=""
            value={parseFloat(stats.winRate)}
            max={100}
            status={getWinRateStatus(parseFloat(stats.winRate))}
          />
        </div>

        {isCS2 ? (
          <>
            <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
              <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                ADR
              </span>
              <span className="text-3xl font-black text-white">
                {stats.avg_adr || "0.0"}
              </span>
              <StatBar
                label=""
                value={parseFloat(stats.avg_adr || 0)}
                max={120}
                status={getCS2FieldStatus(
                  "adr",
                  parseFloat(stats.avg_adr || 0),
                )}
              />
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
              <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                KPR
              </span>
              <span className="text-3xl font-black text-white">
                {stats.kpr || "0.0"}
              </span>
              <StatBar
                label=""
                value={parseFloat(stats.kpr || 0)}
                max={1.1}
                status={getCS2FieldStatus("kpr", parseFloat(stats.kpr || 0))}
              />
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
              <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                DPR
              </span>
              <span className="text-3xl font-black text-white">
                {stats.dpr || "0.0"}
              </span>
              <StatBar
                label=""
                value={parseFloat(stats.dpr || 0)}
                max={1.1}
                status={getCS2FieldStatus("dpr", parseFloat(stats.dpr || 0))}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
              <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                GPM
              </span>
              <span className="text-3xl font-black text-white">
                {Math.round(stats.avg_gpm || 0)}
              </span>
              <StatBar
                label=""
                value={parseFloat(stats.avg_gpm || 0)}
                max={1000}
                status={getDotaFieldStatus(
                  "gpm",
                  parseFloat(stats.avg_gpm || 0),
                )}
              />
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
              <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                XPM
              </span>
              <span className="text-3xl font-black text-white">
                {Math.round(stats.avg_xpm || 0)}
              </span>
              <StatBar
                label=""
                value={parseFloat(stats.avg_xpm || 0)}
                max={1000}
                status={getDotaFieldStatus(
                  "xpm",
                  parseFloat(stats.avg_xpm || 0),
                )}
              />
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
              <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                Net Worth
              </span>
              <span className="text-2xl font-black text-yellow-500">
                {Math.round((stats.avg_netWorth || 0) / 1000)}k
              </span>
              <StatBar
                label=""
                value={parseFloat(stats.avg_netWorth || 0)}
                max={40000}
                status={getDotaFieldStatus(
                  "netWorth",
                  parseFloat(stats.avg_netWorth || 0),
                )}
              />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 border-t border-slate-800 pt-6">
        <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
          <span className="text-slate-400 flex items-center gap-2">
            <Swords size={16} className="text-esports-primary" />
            Всього вбивств
          </span>
          <span className="font-bold text-white">{stats.total_kills || 0}</span>
        </div>
        <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
          <span className="text-slate-400 flex items-center gap-2">
            <Shield size={16} className="text-slate-500" />
            Зіграно матчів
          </span>
          <span className="font-bold text-white">
            {stats.matchesPlayed || 0}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
          <span className="text-slate-400 flex items-center gap-2">
            <Skull size={16} className="text-red-400" />
            Всього смертей
          </span>
          <span className="font-bold text-white">
            {stats.total_deaths || 0}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
          <span className="text-slate-400 flex items-center gap-2">
            <Target size={16} className="text-blue-400" />
            Зіграно карт
          </span>
          <span className="font-bold text-white">
            {stats.totalMapsPlayed || 0}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm md:border-none pb-2">
          <span className="text-slate-400 flex items-center gap-2">
            <Activity size={16} className="text-green-400" />
            Всього асистів
          </span>
          <span className="font-bold text-white">
            {stats.total_assists || 0}
          </span>
        </div>
        {isCS2 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <Crosshair size={16} className="text-yellow-500" />
              Відсоток Headshots
            </span>
            <span className="font-bold text-white">
              {stats.avg_headshots ? `${stats.avg_headshots}%` : "0%"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
