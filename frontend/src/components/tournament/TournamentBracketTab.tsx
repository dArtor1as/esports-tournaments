import { Calendar, GitBranch } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import TournamentBracket from "@/components/TournamentBracket";

interface TournamentBracketTabProps {
  matches: any[];
  tournament: any;
  participantsCount: number;
  bracketLoading: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  onGenerateBracket: () => void;
}

export default function TournamentBracketTab({
  matches,
  tournament,
  participantsCount,
  bracketLoading,
  isCreator,
  isAdmin,
  onGenerateBracket,
}: TournamentBracketTabProps) {
  const sortedMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => {
      if (a.stage !== b.stage) return a.stage.localeCompare(b.stage);
      if (a.bracket !== b.bracket)
        return (a.bracket || "").localeCompare(b.bracket || "");
      if (a.round !== b.round) return a.round - b.round;
      // Якщо це матчі одного раунду — сортуємо за ID
      return a.id.localeCompare(b.id);
    });
  }, [matches]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl overflow-hidden min-h-[400px]">
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <Calendar size={18} className="text-esports-primary" /> Офіційні матчі
        </h3>

        {(isCreator || isAdmin) && matches.length === 0 && (
          <Button
            onClick={onGenerateBracket}
            disabled={bracketLoading || participantsCount < 2}
            className="bg-esports-accent text-black hover:bg-esports-accent/90 text-xs font-black uppercase h-8"
          >
            <GitBranch size={14} className="mr-1.5" />{" "}
            {bracketLoading ? "Формування..." : "Згенерувати сітку"}
          </Button>
        )}
      </div>
      {/* ПЕРЕДАЄМО ВІДСОРТОВАНИЙ МАСИВ */}
      <TournamentBracket
        matches={sortedMatches}
        bracketType={tournament.settings?.bracketType || "SINGLE_ELIMINATION"}
      />
    </div>
  );
}
