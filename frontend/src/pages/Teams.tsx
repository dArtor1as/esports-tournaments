import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Trophy, Users, Globe, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Teams() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"cs2" | "dota2">("cs2");

  const { data: teamsData, isLoading } = useQuery({
    queryKey: ["allTeams"],
    queryFn: async () => {
      const { data } = await api.get("/leaderboards/teams?limit=100");
      return data;
    },
  });

  const allTeams = teamsData?.data || [];

  // Фільтруємо команди за обраною дисципліною
  const filteredTeams = activeTab
    ? typeof allTeams[0]?.game === "object"
      ? allTeams.filter((t: any) => t.game?.slug === activeTab)
      : allTeams
    : allTeams;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ШАПКА ТА ПЕРЕМИКАЧ ДИСЦИПЛІН */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Trophy className="text-yellow-500" size={32} />
            Глобальний Лідерборд Команд
          </h1>
          <p className="text-esports-muted mt-1">
            Рейтинг кіберспортивних організацій за показником Elo.
          </p>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("cs2")}
            className={`flex-1 md:flex-none px-5 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${
              activeTab === "cs2"
                ? "bg-esports-accent text-black shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Counter-Strike 2
          </button>
          <button
            onClick={() => setActiveTab("dota2")}
            className={`flex-1 md:flex-none px-5 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${
              activeTab === "dota2"
                ? "bg-esports-accent text-black shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Dota 2
          </button>
        </div>
      </div>

      {/* СПИСОК КОМАНД У ВИГЛЯДІ РЯДКІВ */}
      {isLoading ? (
        <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
          Завантаження рейтингу...
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl text-esports-muted italic">
          У цій дисципліні ще немає активних команд.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredTeams.map((team: any, index: number) => {
            const rank = index + 1;

            // Кастомні стилі кольору для призової трійки (Подіум)
            const getRankColor = (r: number) => {
              if (r === 1)
                return "text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]";
              if (r === 2) return "text-slate-300";
              if (r === 3) return "text-amber-600";
              return "text-slate-500";
            };

            return (
              <div
                key={team.id}
                onClick={() => navigate(`/team/${team.id}`)}
                className="bg-slate-900 border border-slate-800 text-white p-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-esports-primary/10 hover:border-esports-primary cursor-pointer flex items-center justify-between gap-4 group relative overflow-hidden"
              >
                {/* Золотий маркер на весь рядок для ТОП-1 */}
                {rank === 1 && (
                  <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-yellow-500 via-amber-400 to-yellow-600"></div>
                )}

                {/* ЛІВА ЧАСТИНА: Номер, Назва, Тег, Регіон */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Порядковий номер (Ранг) для кожної команди */}
                  <div
                    className={`w-12 text-center font-black text-xl flex-shrink-0 tracking-tight ${getRankColor(rank)}`}
                  >
                    #{rank}
                  </div>

                  <div className="min-w-0 flex flex-col md:flex-row md:items-center md:gap-4 flex-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-black text-lg text-white group-hover:text-esports-light transition-colors truncate">
                        {team.name}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-[10px] font-black text-esports-accent uppercase tracking-wider flex-shrink-0">
                        {team.tag}
                      </span>
                    </div>

                    <div className="text-esports-light font-black tracking-wider text-xs bg-slate-800/50 border border-slate-700/30 px-2 py-0.5 rounded flex items-center gap-1.5 mt-1 md:mt-0 flex-shrink-0">
                      <Globe size={13} className="text-esports-accent" />
                      <span>{team.region}</span>
                      {rank === 1 && (
                        <span className="text-yellow-400 ml-1 font-black text-[10px] animate-pulse">
                          👑 #1 RANKED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ПРАВА ЧАСТИНА: Статус складу, Ело, Стрілочка */}
                <div className="flex items-center gap-5 md:gap-8 flex-shrink-0">
                  {/* Комплектність складу (ховається на малих мобілках для компактності) */}
                  <div className="hidden sm:flex flex-col items-end text-right">
                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">
                      Склад ростера
                    </span>
                    <span
                      className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${team.isComplete ? "text-green-500" : "text-yellow-500"}`}
                    >
                      <Users size={12} />
                      {team.isComplete ? "Повний" : "Шукають +"}
                    </span>
                  </div>

                  {/* Командний Elo плашка */}
                  <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 px-4 py-2 rounded-xl min-w-[105px] justify-center shadow-inner">
                    <Trophy
                      size={15}
                      className={
                        rank === 1 ? "text-yellow-400" : "text-slate-500"
                      }
                    />
                    <span
                      className={`font-black text-base tracking-tight ${rank === 1 ? "text-yellow-400" : "text-white"}`}
                    >
                      {team.averageRating}
                    </span>
                  </div>

                  {/* Стрілочка переходу, яка підсвічується разом із рядком */}
                  <ChevronRight
                    size={18}
                    className="text-slate-600 group-hover:text-esports-accent group-hover:translate-x-0.5 transition-all flex-shrink-0"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
