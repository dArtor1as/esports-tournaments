import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Trophy, Users, Globe, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TournamentFormModal from "@/components/tournament/TournamentFormModal";

type TournamentStatus = "planned" | "live" | "finished" | "cancelled";

export default function Tournaments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | "all">(
    "planned",
  );

  // Запит на турніри через TournamentsQueryController
  const { data: tournamentsData, isLoading } = useQuery({
    queryKey: ["tournaments", statusFilter],
    queryFn: async () => {
      const statusParam =
        statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const { data } = await api.get(`/tournaments?limit=50${statusParam}`);
      return data; // Пагінований результат
    },
  });

  const tournaments = tournamentsData?.data || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planned":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "live":
        return "text-red-500 bg-red-500/10 border-red-500/20 animate-pulse";
      case "finished":
        return "text-slate-400 bg-slate-800 border-slate-700";
      case "cancelled":
        return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      default:
        return "text-slate-400 bg-slate-800 border-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "planned":
        return "Реєстрація / Заплановано";
      case "live":
        return "🔴 LIVE";
      case "finished":
        return "Завершено";
      case "cancelled":
        return "Скасовано";
      default:
        return status;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-esports-primary/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white flex items-center gap-3 tracking-tight">
            <Trophy className="text-esports-primary" size={36} />
            Турнірний Хаб
          </h1>
          <p className="text-slate-400 mt-2 max-w-lg">
            Змагайтеся з кращими командами, здобувайте перемоги та піднімайте
            свій командний Elo у глобальному рейтингу.
          </p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row gap-3">
          {/* Адмінська кнопка авто-заповнення */}
          {user?.role === "ADMIN" && <TournamentFormModal mode="test" />}

          {/* Звичайна кнопка створення для всіх авторизованих користувачів */}
          {user && <TournamentFormModal mode="standard" />}
        </div>
      </div>

      {/* ФІЛЬТРИ */}
      <div className="flex gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800 w-max">
        {["all", "planned", "live", "finished"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status as any)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${
              statusFilter === status
                ? "bg-esports-accent text-black shadow-md"
                : "text-slate-500 hover:text-white"
            }`}
          >
            {status === "all"
              ? "Всі"
              : getStatusLabel(status).replace("🔴 ", "")}
          </button>
        ))}
      </div>

      {/* СПИСОК ТУРНІРІВ */}
      {isLoading ? (
        <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
          Завантаження розкладу...
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 italic">
          Турнірів з таким статусом не знайдено.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tournaments.map((tournament: any) => {
            const isFull =
              tournament._count?.participants >= tournament.maxParticipants;

            return (
              <div
                key={tournament.id}
                onClick={() => navigate(`/tournament/${tournament.id}`)}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg hover:shadow-xl hover:border-esports-primary/50 transition-all cursor-pointer group flex flex-col justify-between min-h-[200px]"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <Badge
                      className={`border uppercase text-[10px] font-black tracking-wider px-2 py-0.5 ${getStatusColor(tournament.status)}`}
                    >
                      {getStatusLabel(tournament.status)}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      <Globe size={12} /> {tournament.region}
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-white group-hover:text-esports-light transition-colors leading-tight mb-2">
                    {tournament.title}
                  </h3>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-esports-accent bg-esports-accent/5 uppercase text-[10px]"
                    >
                      {tournament.game?.name || "Game"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-slate-300 uppercase text-[10px]"
                    >
                      Tier {tournament.tier}
                    </Badge>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                      <Users
                        size={16}
                        className={isFull ? "text-green-500" : "text-slate-500"}
                      />
                      <span className="font-bold text-white">
                        {tournament._count?.participants || 0}
                      </span>
                      <span className="text-xs">
                        / {tournament.maxParticipants} команд
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    className="p-0 h-auto text-esports-primary group-hover:translate-x-1 transition-transform"
                  >
                    Деталі <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
