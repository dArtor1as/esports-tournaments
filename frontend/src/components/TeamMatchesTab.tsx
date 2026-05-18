import { Calendar, History } from "lucide-react";
import { Link } from "react-router-dom";

interface TeamMatchesTabProps {
  upcomingMatches: any[];
  historyMatches: any[];
  teamId: string;
  teamTag: string;
  teamName: string;
}

export default function TeamMatchesTab({
  upcomingMatches,
  historyMatches,
  teamId,
  teamTag,
  teamName,
}: TeamMatchesTabProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div>
        <h3 className="text-base font-black text-esports-accent uppercase tracking-wider mb-3 flex items-center gap-2">
          <Calendar size={16} /> Майбутні матчі команди
        </h3>
        {upcomingMatches.length === 0 ? (
          <p className="text-slate-500 text-sm italic p-4 bg-slate-950 rounded-xl border border-slate-800/40 border-dashed text-center">
            Розклад порожній. Немає запланованих ігор.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingMatches.map((match) => (
              <Link
                key={match.id}
                to={`/match/${match.id}`}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 cursor-pointer group hover:border-esports-primary hover:scale-[1.02] transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 justify-center font-mono">
                  <span className="font-black text-white truncate text-right flex-1 text-sm">
                    [{match.teamA?.tag || "TBD"}] {match.teamA?.name || "TBD"}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-black text-slate-500">
                    VS
                  </span>
                  <span className="font-black text-white truncate text-left flex-1 text-sm">
                    [{match.teamB?.tag || "TBD"}] {match.teamB?.name || "TBD"}
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-bold border-l border-slate-800 pl-4 flex-shrink-0">
                  <p className="text-esports-light truncate max-w-[100px] font-black uppercase tracking-wider">
                    {match.tournament?.title}
                  </p>
                  <p className="mt-0.5">
                    {new Date(match.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-base font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <History size={16} /> Останні результати
        </h3>
        {historyMatches.length === 0 ? (
          <p className="text-slate-500 text-sm italic p-4 bg-slate-950 rounded-xl border border-slate-800/40 border-dashed text-center">
            Команда ще не зіграла жодного матчу.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {historyMatches.map((match) => {
              const isTeamA = match.teamAId === teamId;
              const myScore = isTeamA ? match.scoreA : match.scoreB;
              const oppScore = isTeamA ? match.scoreB : match.scoreA;
              const isWin = myScore > oppScore;
              const oppName = isTeamA ? match.teamB?.name : match.teamA?.name;
              const oppTag = isTeamA ? match.teamB?.tag : match.teamA?.tag;

              return (
                <Link
                  key={match.id}
                  to={`/match/${match.id}`}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 cursor-pointer group hover:border-esports-primary hover:bg-slate-900/80 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${isWin ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`}
                    />
                    <span className="font-black text-white truncate text-sm">
                      [{teamTag}] {teamName}{" "}
                      <span className="text-slate-500 font-normal px-1.5 text-xs">
                        vs
                      </span>
                      <span className="text-slate-500 font-normal">
                        [{oppTag || "TBD"}]
                      </span>{" "}
                      {oppName || "Unknown Team"}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span
                      className={`font-mono font-black text-base ${isWin ? "text-green-400" : "text-red-400"}`}
                    >
                      {myScore} : {oppScore}
                    </span>
                    <span className="text-right text-xs text-slate-500 hidden sm:block font-bold uppercase tracking-wider max-w-[120px] truncate">
                      {match.tournament?.title}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
