import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TournamentHeaderProps {
  tournament: any;
  isAdmin: boolean;
}

export default function TournamentHeader({
  tournament,
}: TournamentHeaderProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div className="absolute top-0 left-0 w-96 h-full bg-gradient-to-r from-esports-primary/10 to-transparent pointer-events-none"></div>
      <div className="flex items-center gap-5 relative z-10">
        <div className="w-16 h-16 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center font-black text-2xl text-yellow-500 shadow-inner">
          <Trophy size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {tournament.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-4">
            <span>
              Дисципліна:{" "}
              <strong className="text-esports-accent uppercase">
                {tournament.game?.name}
              </strong>
            </span>
            <span>
              Регіон:{" "}
              <strong className="text-white">{tournament.region}</strong>
            </span>
            <span>
              Тір:{" "}
              <strong className="text-slate-300">Tier {tournament.tier}</strong>
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 relative z-10">
        <Badge className="bg-esports-primary/20 text-esports-light border-esports-primary/30 uppercase font-black tracking-widest text-xs px-3 py-1 text-center justify-center">
          {tournament.status.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}
