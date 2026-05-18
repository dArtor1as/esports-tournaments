import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// Підключення декомпозованих компонентів
import MatchConsensusPanel from "@/components/match/MatchConsensusPanel";
import MatchRosters from "@/components/match/MatchRosters";
import MatchPostGameStats from "@/components/match/MatchPostGameStats";

export default function MatchRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  const {
    data: match,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["match", id],
    queryFn: async () => (await api.get(`/matches/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading)
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження матч-руму...
      </div>
    );
  if (!match)
    return (
      <div className="text-center py-20 text-red-500 font-bold">
        Матч не знайдено.
      </div>
    );

  const winScoreLimit = Math.floor((match.bestOf || 3) / 2) + 1;
  const status = match.matchStatus || "PENDING";
  const isCompleted = status === "COMPLETED" || match.isProcessed;
  const isDisputed = status === "DISPUTED";

  // Універсальний обробник дій (Консенсус)
  const handleAction = async (action: string, payload: any = {}) => {
    if (action === "report" || action === "force-resolve") {
      const sA = parseInt(payload.scoreA);
      const sB = parseInt(payload.scoreB);

      if (isNaN(sA) || isNaN(sB) || sA < 0 || sB < 0)
        return toast.error("Вкажіть коректні числа для рахунку.");
      if (sA > winScoreLimit || sB > winScoreLimit)
        return toast.error(
          `Максимально можливий рахунок для Bo${match.bestOf} — це ${winScoreLimit}.`,
        );
      if (sA !== winScoreLimit && sB !== winScoreLimit)
        return toast.error(
          `Матч не закінчено. Хтось має набрати ${winScoreLimit} перемог(и).`,
        );
      if (sA === sB) return toast.error("Рахунок серії не може бути нічийним.");

      payload.scoreA = sA;
      payload.scoreB = sB;
    }

    setLoading(true);
    try {
      await api.post(`/matches/${id}/${action}`, payload);
      toast.success("Дію успішно виконано!");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["tournamentMatches"] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Помилка виконання дії");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад до турніру
      </Button>

      {/* ШАПКА МАТЧУ */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-6 relative z-10">
          <Badge
            variant="outline"
            className="text-slate-400 border-slate-700 uppercase tracking-widest mb-3 bg-slate-950"
          >
            {match.tournament?.title} • {match.stage} • Раунд {match.round}
          </Badge>

          <div className="flex justify-center items-center gap-4 md:gap-12 mt-2">
            <div className="flex flex-col items-center gap-3 w-1/3">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg ${match.scoreA > match.scoreB && isCompleted ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(52,211,153,0.2)]" : "bg-slate-800 text-white border border-slate-700"}`}
              >
                {match.teamA?.tag || "TBD"}
              </div>
              <h2 className="text-lg md:text-2xl font-black text-white truncate w-full text-center">
                {match.teamA?.name || "Очікування..."}
              </h2>
            </div>

            <div className="flex flex-col items-center justify-center w-1/3">
              <div className="text-5xl md:text-6xl font-black text-esports-accent tracking-tighter drop-shadow-[0_0_15px_rgba(242,167,27,0.3)]">
                {match.scoreA ?? 0}{" "}
                <span className="text-slate-600 font-light mx-1">:</span>{" "}
                {match.scoreB ?? 0}
              </div>
              <Badge
                className={`mt-5 px-4 py-1 uppercase font-black tracking-widest text-[10px] ${
                  isCompleted
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : isDisputed
                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                      : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
              >
                {isCompleted
                  ? "Матч Завершено"
                  : isDisputed
                    ? "Диспут"
                    : status.replace("_", " ")}
              </Badge>
              <div className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest font-bold">
                Best of {match.bestOf}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 w-1/3">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg ${match.scoreB > match.scoreA && isCompleted ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(52,211,153,0.2)]" : "bg-slate-800 text-white border border-slate-700"}`}
              >
                {match.teamB?.tag || "TBD"}
              </div>
              <h2 className="text-lg md:text-2xl font-black text-white truncate w-full text-center">
                {match.teamB?.name || "Очікування..."}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* ПАНЕЛЬ КОНСЕНСУСУ (Зникає, коли матч завершено) */}
      <MatchConsensusPanel
        match={match}
        currentUser={currentUser}
        loading={loading}
        onAction={handleAction}
      />

      {/* ТАБИ КОНТЕНТУ МАТЧУ */}
      <div className="mt-10">
        <Tabs
          defaultValue={isCompleted ? "stats" : "rosters"}
          className="w-full"
        >
          <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex flex-wrap w-full md:w-max mb-6">
            <TabsTrigger
              value="rosters"
              className="px-6 py-2 text-xs font-black uppercase tracking-wider"
            >
              Ростери
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="px-6 py-2 text-xs font-black uppercase tracking-wider"
            >
              Статистика
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rosters">
            <MatchRosters match={match} />
          </TabsContent>

          <TabsContent value="stats">
            <MatchPostGameStats match={match} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
