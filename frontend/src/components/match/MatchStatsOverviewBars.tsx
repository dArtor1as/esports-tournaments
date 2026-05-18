import { Activity } from "lucide-react";

interface MatchStatsOverviewBarsProps {
  match: any;
  totalsA: any;
  totalsB: any;
  isCS2: boolean;
}

export default function MatchStatsOverviewBars({
  match,
  totalsA,
  totalsB,
  isCS2,
}: MatchStatsOverviewBarsProps) {
  const ComparisonBar = ({
    label,
    valA,
    valB,
  }: {
    label: string;
    valA: number;
    valB: number;
  }) => {
    const total = valA + valB;
    const pctA = total > 0 ? (valA / total) * 100 : 50;
    const pctB = total > 0 ? (valB / total) * 100 : 50;
    const formatValue = (val: number) =>
      label === "Net Worth" && val >= 1000
        ? `${(val / 1000).toFixed(1)}k`
        : val;

    return (
      <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
        <span className="w-24 text-left uppercase tracking-wider text-[11px] text-slate-500 font-black">
          {label}
        </span>
        <span className="w-10 text-right text-white font-mono">
          {formatValue(valA)}
        </span>
        <div className="flex-1 h-6 flex relative bg-slate-950 rounded-md overflow-hidden border border-slate-800">
          <div
            className="h-full bg-amber-500 transition-all duration-500 shadow-[inset_-10px_0_15px_rgba(0,0,0,0.2)]"
            style={{ width: `${pctA}%` }}
          ></div>
          <div
            className="h-full bg-slate-700 transition-all duration-500"
            style={{ width: `${pctB}%` }}
          ></div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-950 z-10"></div>
        </div>
        <span className="w-10 text-left text-white font-mono">
          {formatValue(valB)}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/40">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Activity size={14} className="text-amber-500" /> Performance overview
        </h3>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-black text-white text-base">
            <span className="text-amber-500">[{match.teamA?.tag}]</span>{" "}
            {match.teamA?.name}
          </div>
          <div className="flex items-center gap-2 font-black text-white text-base">
            {match.teamB?.name}{" "}
            <span className="text-slate-500">[{match.teamB?.tag}]</span>
          </div>
        </div>
        <div className="space-y-3.5 max-w-2xl mx-auto">
          <ComparisonBar
            label="Kills"
            valA={totalsA.kills}
            valB={totalsB.kills}
          />
          <ComparisonBar
            label="Deaths"
            valA={totalsA.deaths}
            valB={totalsB.deaths}
          />
          <ComparisonBar
            label="Assists"
            valA={totalsA.assists}
            valB={totalsB.assists}
          />
          {!isCS2 && (totalsA.netWorth > 0 || totalsB.netWorth > 0) && (
            <ComparisonBar
              label="Net Worth"
              valA={totalsA.netWorth}
              valB={totalsB.netWorth}
            />
          )}
        </div>
      </div>
    </div>
  );
}
