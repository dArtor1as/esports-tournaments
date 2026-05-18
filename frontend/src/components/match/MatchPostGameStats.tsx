import { useState, useMemo } from "react";
import { Activity, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

import MatchStatsOverviewBars from "./MatchStatsOverviewBars";
import MatchStatsTeamTable from "./MatchStatsTeamTable";

interface MatchPostGameStatsProps {
  match: any;
}

export default function MatchPostGameStats({ match }: MatchPostGameStatsProps) {
  const [selectedMapIndex, setSelectedMapIndex] = useState<number | "all">(
    "all",
  );

  const maps = Array.isArray(match.stats?.maps) ? match.stats.maps : [];
  const hasMaps = maps.length > 0;

  // 1. Агрегація даних (сума по картах або вибірка однієї)
  const { playerStats, totalsA, totalsB } = useMemo(() => {
    const agg: Record<string, any> = {};
    const tA = { kills: 0, deaths: 0, assists: 0, netWorth: 0 };
    const tB = { kills: 0, deaths: 0, assists: 0, netWorth: 0 };

    if (selectedMapIndex === "all") {
      if (hasMaps) {
        maps.forEach((map: any) => {
          map.teamA?.players?.forEach((p: any) => {
            if (!agg[p.playerId])
              agg[p.playerId] = {
                kills: 0,
                deaths: 0,
                assists: 0,
                adrSum: 0,
                hsSum: 0,
                gpmSum: 0,
                xpmSum: 0,
                nwSum: 0,
                damage: 0,
                mapCount: 0,
              };
            const s = agg[p.playerId];
            s.kills += p.kills || 0;
            s.deaths += p.deaths || 0;
            s.assists += p.assists || 0;
            s.adrSum += p.adr || 0;
            s.hsSum += p.headshots || 0;
            s.gpmSum += p.gpm || 0;
            s.xpmSum += p.xpm || 0;
            s.nwSum += p.netWorth || 0;
            s.damage += p.damage || 0;
            s.mapCount += 1;
            tA.kills += p.kills || 0;
            tA.deaths += p.deaths || 0;
            tA.assists += p.assists || 0;
            tA.netWorth += p.netWorth || 0;
          });
          map.teamB?.players?.forEach((p: any) => {
            if (!agg[p.playerId])
              agg[p.playerId] = {
                kills: 0,
                deaths: 0,
                assists: 0,
                adrSum: 0,
                hsSum: 0,
                gpmSum: 0,
                xpmSum: 0,
                nwSum: 0,
                damage: 0,
                mapCount: 0,
              };
            const s = agg[p.playerId];
            s.kills += p.kills || 0;
            s.deaths += p.deaths || 0;
            s.assists += p.assists || 0;
            s.adrSum += p.adr || 0;
            s.hsSum += p.headshots || 0;
            s.gpmSum += p.gpm || 0;
            s.xpmSum += p.xpm || 0;
            s.nwSum += p.netWorth || 0;
            s.damage += p.damage || 0;
            s.mapCount += 1;
            tB.kills += p.kills || 0;
            tB.deaths += p.deaths || 0;
            tB.assists += p.assists || 0;
            tB.netWorth += p.netWorth || 0;
          });
        });

        Object.keys(agg).forEach((pid) => {
          const s = agg[pid];
          if (s.mapCount > 0) {
            s.adr = s.adrSum / s.mapCount;
            s.headshots = s.hsSum / s.mapCount;
            s.gpm = s.gpmSum / s.mapCount;
            s.xpm = s.xpmSum / s.mapCount;
            s.netWorth = s.nwSum / s.mapCount;
          }
        });
      } else {
        const flatStats = Array.isArray(match.stats) ? match.stats : [];
        flatStats.forEach((s: any) => {
          agg[s.playerId] = s;
        });
      }
    } else {
      const mapData = maps[selectedMapIndex];
      mapData?.teamA?.players?.forEach((p: any) => {
        agg[p.playerId] = p;
        tA.kills += p.kills || 0;
        tA.deaths += p.deaths || 0;
        tA.assists += p.assists || 0;
        tA.netWorth += p.netWorth || 0;
      });
      mapData?.teamB?.players?.forEach((p: any) => {
        agg[p.playerId] = p;
        tB.kills += p.kills || 0;
        tB.deaths += p.deaths || 0;
        tB.assists += p.assists || 0;
        tB.netWorth += p.netWorth || 0;
      });
    }

    return { playerStats: agg, totalsA: tA, totalsB: tB };
  }, [match.stats, selectedMapIndex, maps, hasMaps]);

  // Заглушка, якщо стат немає (ручні матчі)
  if (!playerStats || Object.keys(playerStats).length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center shadow-xl">
        <Activity size={48} className="text-slate-700 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">
          Детальна статистика недоступна
        </h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Післяматчева аналітика доступна лише для автоматизованих матчів.
        </p>
      </div>
    );
  }

  // 2. Безпечне визначення дисципліни турніру
  const isCS2 = useMemo(() => {
    const slug = match.tournament?.game?.slug || "";
    if (slug) return slug.toLowerCase() === "cs2";
    return Object.values(playerStats).some(
      (s: any) => s.adr !== undefined && s.adr > 0,
    );
  }, [match.tournament, playerStats]);

  const showDamage = selectedMapIndex !== "all" && isCS2;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* НАВІГАЦІЯ ПО КАРТАХ */}
      {hasMaps && maps.length > 1 && (
        <div className="flex flex-wrap gap-2 bg-slate-950/60 border border-slate-800 p-1.5 rounded-xl w-max shadow-inner">
          <Button
            variant="ghost"
            onClick={() => setSelectedMapIndex("all")}
            className={`px-5 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-lg ${selectedMapIndex === "all" ? "bg-amber-500 text-black font-black shadow-[0_0_15px_rgba(245,158,11,0.25)]" : "text-slate-400 hover:text-white hover:bg-slate-900"}`}
            size="sm"
          >
            Загальна статистика
          </Button>
          {maps.map((map: any, idx: number) => (
            <Button
              key={idx}
              variant="ghost"
              onClick={() => setSelectedMapIndex(idx)}
              className={`px-5 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-lg ${selectedMapIndex === idx ? "bg-amber-500 text-black font-black shadow-[0_0_15px_rgba(245,158,11,0.25)]" : "text-slate-400 hover:text-white hover:bg-slate-900"}`}
              size="sm"
            >
              Карта {idx + 1} {map.mapName ? `— ${map.mapName}` : ""}
            </Button>
          ))}
        </div>
      )}

      {/* HLTV PERFORMANCE OVERVIEW */}
      <MatchStatsOverviewBars
        match={match}
        totalsA={totalsA}
        totalsB={totalsB}
        isCS2={isCS2}
      />

      {/* ТАБЛИЦІ СТАТИСТИКИ */}
      <div>
        <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4">
          <Target size={18} className="text-amber-500" /> Розподіл по гравцях
        </h3>
        <MatchStatsTeamTable
          team={match.teamA}
          playerStats={playerStats}
          isCS2={isCS2}
          showDamage={showDamage}
        />
        <MatchStatsTeamTable
          team={match.teamB}
          playerStats={playerStats}
          isCS2={isCS2}
          showDamage={showDamage}
        />
      </div>
    </div>
  );
}
