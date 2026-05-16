import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import EloRatingChart from "@/components/EloRatingChart";
import PlayerSummaryCard from "@/components/PlayerSummaryCard";
import PlayerStatsPanel from "@/components/PlayerStatsPanel";
import { usePlayerStatsData } from "@/hooks/useProfileData";
import { calculateAge, getFlagUrl, calculateKd } from "@/lib/helpers";

export default function PlayerStats() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { player, eloHistory, isLoading } = usePlayerStatsData(id);

  if (isLoading)
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження аналітики...
      </div>
    );
  if (!player)
    return (
      <div className="text-center py-20 text-red-500">Гравця не знайдено</div>
    );

  const stats = player.stats || {};
  const age = calculateAge(player.user?.birthDate);
  const kd = calculateKd(stats.total_kills, stats.total_deaths);
  const flagUrl = getFlagUrl(player.user?.countryCode, "w40");

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PlayerSummaryCard
            player={player}
            age={age}
            kd={kd}
            flagUrl={flagUrl}
          />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <PlayerStatsPanel
            stats={stats}
            hasStats={Object.keys(stats).length > 0}
            isCS2={player.game?.slug === "cs2"}
          />
        </div>
      </div>

      <EloRatingChart historyData={eloHistory} />
    </div>
  );
}
