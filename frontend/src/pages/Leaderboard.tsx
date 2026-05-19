import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Trophy, Medal, Search, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFlagUrl } from "@/lib/helpers";

const REGIONS = ["EU", "NA", "CIS", "ASIA", "SA", "GLOBAL"];

export default function Leaderboard() {
  const navigate = useNavigate();
  const [regionFilter, setRegionFilter] = useState("GLOBAL");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGame, setActiveGame] = useState<"cs2" | "dota2">("cs2");

  const { data: playersData, isLoading } = useQuery({
    queryKey: ["playersLeaderboard", regionFilter, activeGame],
    queryFn: async () => {
      const regionQuery =
        regionFilter !== "GLOBAL" ? `&region=${regionFilter}` : "";
      const gameQuery = `&gameSlug=${activeGame}`; // Передаємо гру
      const { data } = await api.get(
        `/leaderboards/players?limit=100${regionQuery}${gameQuery}`,
      );
      return data.data || [];
    },
  });
  // Локальний пошук за нікнеймом
  const filteredPlayers =
    playersData?.filter((p: any) =>
      p.nickname.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ШАПКА ТА ПЕРЕМИКАЧ ДИСЦИПЛІН */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Trophy className="text-yellow-500" size={32} />
            Зала Слави
          </h1>
          <p className="text-esports-muted mt-1">
            Рейтинг найкращих гравців платформи за показником Elo.
          </p>
        </div>

        {/* ПЕРЕМИКАЧ ІГОР  */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 w-full md:w-auto">
          <button
            onClick={() => setActiveGame("cs2")}
            className={`flex-1 md:flex-none px-5 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${
              activeGame === "cs2"
                ? "bg-esports-accent text-black shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Counter-Strike 2
          </button>
          <button
            onClick={() => setActiveGame("dota2")}
            className={`flex-1 md:flex-none px-5 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${
              activeGame === "dota2"
                ? "bg-esports-accent text-black shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Dota 2
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex items-center gap-3 w-full justify-end">
        <div className="relative w-full md:w-64">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <Input
            placeholder="Пошук гравця..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-950 border-slate-800 text-white"
          />
        </div>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-[120px] bg-slate-950 border-slate-800 text-white">
            <Globe size={16} className="mr-2 text-slate-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 text-white">
            {REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800/80 text-xs font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-16 text-center">Місце</th>
                <th className="px-6 py-4">Гравець</th>
                <th className="px-6 py-4 hidden md:table-cell">Команда</th>
                <th className="px-6 py-4 text-right">Рейтинг (ELO)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-20 text-center text-slate-500 font-bold animate-pulse"
                  >
                    Синхронізація з базою даних...
                  </td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-20 text-center text-slate-500 italic"
                  >
                    Гравців не знайдено.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player: any, index: number) => {
                  const rank = index + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;

                  return (
                    <tr
                      key={player.id}
                      onClick={() => navigate(`/player/${player.id}`)}
                      className="border-b border-slate-800/40 hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 text-center">
                        {isTop1 ? (
                          <Medal
                            size={24}
                            className="text-yellow-400 mx-auto drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                          />
                        ) : isTop2 ? (
                          <Medal size={24} className="text-slate-300 mx-auto" />
                        ) : isTop3 ? (
                          <Medal size={24} className="text-amber-600 mx-auto" />
                        ) : (
                          <span className="text-slate-500 font-black text-sm">
                            #{rank}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getFlagUrl(player.user?.countryCode) && (
                            <img
                              src={getFlagUrl(player.user?.countryCode)!}
                              alt="Flag"
                              className="w-5 rounded-sm shadow-sm"
                            />
                          )}
                          <span
                            className={`font-bold text-base transition-colors ${isTop1 ? "text-yellow-400" : "text-white group-hover:text-esports-light"}`}
                          >
                            {player.nickname}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 hidden md:table-cell">
                        {player.team ? (
                          <div
                            className="flex items-center gap-2 hover:text-white transition-colors text-slate-400 text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/team/${player.team.id}`);
                            }}
                          >
                            <span className="font-black text-esports-accent text-[10px] uppercase border border-esports-accent/30 bg-esports-accent/10 px-1.5 py-0.5 rounded">
                              [{player.team.tag}]
                            </span>
                            <span className="font-bold truncate max-w-[150px]">
                              {player.team.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 italic font-medium">
                            Вільний агент
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                          <Trophy
                            size={14}
                            className={
                              isTop1 ? "text-yellow-400" : "text-slate-500"
                            }
                          />
                          <span
                            className={`font-black text-lg ${isTop1 ? "text-yellow-400" : "text-white"}`}
                          >
                            {player.rating}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
