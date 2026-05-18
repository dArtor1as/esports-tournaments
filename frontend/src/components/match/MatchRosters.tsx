import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MatchRosters({ match }: { match: any }) {
  const renderRoster = (team: any) => {
    if (!team)
      return (
        <p className="text-xs text-slate-500 italic">Команда ще не визначена</p>
      );
    const players =
      team.players?.filter((p: any) => p.inGameRole !== "COACH") || [];
    const coaches =
      team.players?.filter((p: any) => p.inGameRole === "COACH") || [];

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {players.map((p: any) => (
            <Link
              key={p.id}
              to={`/player/${p.id}`}
              className="flex items-center gap-3 p-2 bg-slate-950 rounded-xl border border-slate-800 hover:border-esports-primary transition-colors group"
            >
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-slate-500">
                <User size={18} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white group-hover:text-esports-primary transition-colors text-sm">
                  {p.nickname}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                  {p.inGameRole || "Player"}
                </span>
              </div>
              <Badge
                variant="outline"
                className="ml-auto border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-black text-xs drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
              >
                {p.rating} ELO
              </Badge>
            </Link>
          ))}
        </div>
        {coaches.length > 0 && (
          <div className="pt-3 border-t border-slate-800/50 space-y-2">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Тренер
            </h4>
            {coaches.map((c: any) => (
              <Link
                key={c.id}
                to={`/player/${c.id}`}
                className="flex items-center gap-3 p-2 bg-slate-950/40 rounded-xl border border-slate-800/50 hover:border-esports-primary/50 transition-colors group"
              >
                <div className="w-8 h-8 bg-slate-900/50 rounded-md flex items-center justify-center text-slate-600">
                  <User size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-300 group-hover:text-esports-light text-sm">
                    {c.nickname}
                  </span>
                  <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">
                    Coach
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-base font-black text-white mb-4 border-b border-slate-800 pb-3">
          Склад [{match.teamA?.tag || "TBD"}]
        </h3>
        {renderRoster(match.teamA)}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-base font-black text-white mb-4 border-b border-slate-800 pb-3">
          Склад [{match.teamB?.tag || "TBD"}]
        </h3>
        {renderRoster(match.teamB)}
      </div>
    </div>
  );
}
