import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  ArrowLeft,
  Crosshair,
  Skull,
  Activity,
  Shield,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
// Імпортуємо компоненти графіка Recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const calculateAge = (dateString?: string) => {
  if (!dateString) return null;
  const today = new Date();
  const birthDate = new Date(dateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.change >= 0;

    return (
      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-2xl text-xs space-y-2 min-w-[180px]">
        <p className="font-black text-white truncate max-w-[200px]">
          {data.tournamentTitle}
        </p>
        <p className="text-slate-500 font-medium">{data.displayDate}</p>
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
          <span className="text-slate-400 font-medium">Рейтинг Elo:</span>
          <span className="text-yellow-400 font-black text-sm drop-shadow-[0_0_4px_rgba(250,204,21,0.2)]">
            {data.Elo}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Зміна:</span>
          <span
            className={`font-black text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}
          >
            {isPositive ? `+${data.change}` : data.change}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Оновлений StatBar з підтримкою реальних кіберспортивних оцінок
interface StatBarProps {
  label: string;
  value: number;
  max: number;
  status: "GOOD" | "AVERAGE" | "POOR";
}

const StatBar = ({ label, value, max, status }: StatBarProps) => {
  const percentage = Math.min((value / max) * 100, 100);

  const statusConfig = {
    GOOD: { text: "GOOD", bar: "bg-green-500", textClass: "text-green-500" },
    AVERAGE: {
      text: "AVERAGE",
      bar: "bg-yellow-500",
      textClass: "text-yellow-500",
    },
    POOR: { text: "POOR", bar: "bg-red-500", textClass: "text-red-500" },
  };

  const current = statusConfig[status];

  return (
    <div className="flex flex-col space-y-1 w-full mt-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className={current.textClass}>{current.text}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${current.bar} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default function PlayerStats() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 1. Запит на дані гравця
  const { data: player, isLoading: isPlayerLoading } = useQuery({
    queryKey: ["playerStats", id],
    queryFn: async () => {
      const { data } = await api.get(`/players/${id}`);
      return data;
    },
    enabled: !!id,
  });

  // 2. Запит на історію Elo для графіка
  const { data: eloHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["playerEloHistory", id],
    queryFn: async () => {
      const { data } = await api.get(`/analytics/player/${id}/rating-history`);
      return data;
    },
    enabled: !!id,
  });

  if (isPlayerLoading || isHistoryLoading) {
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження аналітики...
      </div>
    );
  }

  if (!player) {
    return (
      <div className="text-center py-20 text-red-500">Гравця не знайдено</div>
    );
  }

  const stats = player.stats || {};
  const hasStats = Object.keys(stats).length > 0;
  const isCS2 = player.game?.slug === "cs2";
  const age = calculateAge(player.user?.birthDate);

  // Розрахунок похідного стану (Derived State) для K/D
  const totalKills = Number(stats.total_kills || 0);
  const totalDeaths = Number(stats.total_deaths || 0);
  const kd =
    totalDeaths > 0
      ? (totalKills / totalDeaths).toFixed(2)
      : totalKills.toFixed(2);

  // Функції оцінки метрик (Кіберспортивні рамки)
  const getWinRateStatus = (wr: number) => {
    if (wr >= 54) return "GOOD";
    if (wr >= 48) return "AVERAGE";
    return "POOR";
  };

  const getCS2FieldStatus = (field: "adr" | "kpr" | "dpr", val: number) => {
    if (field === "adr") {
      if (val >= 85) return "GOOD";
      if (val >= 72) return "AVERAGE";
      return "POOR";
    }
    if (field === "kpr") {
      if (val >= 0.75) return "GOOD";
      if (val >= 0.65) return "AVERAGE";
      return "POOR";
    }
    if (field === "dpr") {
      if (val <= 0.65) return "GOOD"; // Менше смертей - краще
      if (val <= 0.75) return "AVERAGE";
      return "POOR";
    }
    return "AVERAGE";
  };

  const getDotaFieldStatus = (
    field: "gpm" | "xpm" | "netWorth",
    val: number,
  ) => {
    if (val === 0) return "POOR"; // Відсікаємо нулі для нових профілів
    if (field === "gpm") {
      if (val >= 650) return "GOOD";
      if (val >= 450) return "AVERAGE";
      return "POOR";
    }
    if (field === "xpm") {
      if (val >= 700) return "GOOD";
      if (val >= 500) return "AVERAGE";
      return "POOR";
    }
    if (field === "netWorth") {
      if (val >= 20000) return "GOOD";
      if (val >= 12000) return "AVERAGE";
      return "POOR";
    }
    return "AVERAGE";
  };

  // Форматування даних для Recharts графіка
  const chartData = eloHistory.map((historyItem: any, idx: number) => ({
    // Використовуємо унікальний індекс як ключ для графіка, оскільки може бути кілька записів з однаковою датою
    index: idx + 1,
    displayDate: new Date(historyItem.createdAt).toLocaleDateString(),
    tournamentTitle: historyItem.match?.tournament?.title || "Товариський матч",
    Elo: historyItem.newRating,
    change: historyItem.ratingChange,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-esports-muted hover:text-white hover:bg-slate-800 mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ЛІВА КАРТКА ГРАВЦЯ */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-b from-esports-primary/10 to-slate-900 z-0"></div>
            <div className="relative z-10 p-6 flex flex-col items-center text-center">
              <div className="w-full flex justify-between items-start mb-4">
                {player.user?.countryCode && (
                  <img
                    src={`https://flagcdn.com/w40/${player.user.countryCode.toLowerCase()}.png`}
                    width="32"
                    alt={player.user.countryCode}
                    className="rounded shadow-sm border border-slate-800"
                  />
                )}
                {player.team && (
                  <div className="px-2 py-1 bg-slate-950/50 rounded border border-slate-800 text-xs font-black text-esports-accent uppercase">
                    {player.team.tag}
                  </div>
                )}
              </div>

              <div className="w-40 h-40 rounded-full border-4 border-slate-800 bg-slate-950 flex items-center justify-center mb-4 shadow-xl">
                <span className="text-6xl font-black text-slate-800 uppercase">
                  {player.nickname[0]}
                </span>
              </div>

              <h1 className="text-4xl font-black text-white tracking-tight mb-1">
                {player.nickname}
              </h1>
              <p className="text-sm text-esports-muted font-medium mb-6">
                {player.user?.username} {age ? `• ${age} років` : ""}
              </p>

              <div className="w-full bg-slate-950/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                  <span className="text-xs text-slate-500 font-bold uppercase">
                    Дисципліна
                  </span>
                  <span className="text-xs font-black bg-esports-accent/10 text-esports-accent border border-esports-accent/20 px-2 py-0.5 rounded uppercase tracking-wider">
                    {player.game?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/60 py-2">
                  <span className="text-xs text-slate-500 font-bold uppercase">
                    Рейтинг Elo
                  </span>
                  <span className="text-xl font-black text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.3)]">
                    {player.rating}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-slate-500 font-bold uppercase">
                    K/D Ratio
                  </span>
                  <span
                    className={`text-sm font-black ${Number(kd) >= 1.0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {kd}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ПРАВА СЕКЦІЯ СТАТИСТИКИ */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl min-h-[346px]">
            {!hasStats ? (
              <div className="text-center py-16 flex flex-col items-center justify-center h-full">
                <Target size={48} className="text-slate-800 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  Немає даних аналітики
                </h3>
                <p className="text-esports-muted max-w-sm text-sm">
                  Гравця ще не додавали в матчі турнірів. Lifetime-статистика
                  буде згенерована автоматично.
                </p>
              </div>
            ) : (
              <>
                {/* ДИНАМІЧНІ ХЕДЕР-КАРТКИ НА ОСНОВІ ДИСЦИПЛІНИ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-10">
                  <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                    <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                      Win Rate
                    </span>
                    <span className="text-3xl font-black text-white">
                      {stats.winRate}%
                    </span>
                    <StatBar
                      label=""
                      value={parseFloat(stats.winRate)}
                      max={100}
                      status={getWinRateStatus(parseFloat(stats.winRate))}
                    />
                  </div>

                  {isCS2 ? (
                    <>
                      <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                        <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                          ADR
                        </span>
                        <span className="text-3xl font-black text-white">
                          {stats.avg_adr || "0.0"}
                        </span>
                        <StatBar
                          label=""
                          value={parseFloat(stats.avg_adr || 0)}
                          max={120}
                          status={getCS2FieldStatus(
                            "adr",
                            parseFloat(stats.avg_adr || 0),
                          )}
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                        <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                          KPR
                        </span>
                        <span className="text-3xl font-black text-white">
                          {stats.kpr || "0.0"}
                        </span>
                        <StatBar
                          label=""
                          value={parseFloat(stats.kpr || 0)}
                          max={1.1}
                          status={getCS2FieldStatus(
                            "kpr",
                            parseFloat(stats.kpr || 0),
                          )}
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                        <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                          DPR
                        </span>
                        <span className="text-3xl font-black text-white">
                          {stats.dpr || "0.0"}
                        </span>
                        <StatBar
                          label=""
                          value={parseFloat(stats.dpr || 0)}
                          max={1.1}
                          status={getCS2FieldStatus(
                            "dpr",
                            parseFloat(stats.dpr || 0),
                          )}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                        <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                          GPM
                        </span>
                        <span className="text-3xl font-black text-white">
                          {Math.round(stats.avg_gpm || 0)}
                        </span>
                        <StatBar
                          label=""
                          value={parseFloat(stats.avg_gpm || 0)}
                          max={1000}
                          status={getDotaFieldStatus(
                            "gpm",
                            parseFloat(stats.avg_gpm || 0),
                          )}
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                        <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                          XPM
                        </span>
                        <span className="text-3xl font-black text-white">
                          {Math.round(stats.avg_xpm || 0)}
                        </span>
                        <StatBar
                          label=""
                          value={parseFloat(stats.avg_xpm || 0)}
                          max={1000}
                          status={getDotaFieldStatus(
                            "xpm",
                            parseFloat(stats.avg_xpm || 0),
                          )}
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                        <span className="text-slate-400 text-xs font-bold uppercase mb-1">
                          Net Worth
                        </span>
                        <span className="text-2xl font-black text-yellow-500">
                          {Math.round((stats.avg_netWorth || 0) / 1000)}k
                        </span>
                        <StatBar
                          label=""
                          value={parseFloat(stats.avg_netWorth || 0)}
                          max={50000}
                          status={getDotaFieldStatus(
                            "netWorth",
                            parseFloat(stats.avg_netWorth || 0),
                          )}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* НИЖНЯ КЛАСИЧНА ТАБЛИЦЯ ЦИФР */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 border-t border-slate-800 pt-6">
                  <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Swords size={16} className="text-esports-primary" />
                      Всього вбивств
                    </span>
                    <span className="font-bold text-white">
                      {stats.total_kills || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Shield size={16} className="text-slate-500" />
                      Зіграно матчів
                    </span>
                    <span className="font-bold text-white">
                      {stats.matchesPlayed || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Skull size={16} className="text-red-400" />
                      Всього смертей
                    </span>
                    <span className="font-bold text-white">
                      {stats.total_deaths || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-2">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Target size={16} className="text-blue-400" />
                      Зіграно карт
                    </span>
                    <span className="font-bold text-white">
                      {stats.totalMapsPlayed || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm md:border-none pb-2">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Activity size={16} className="text-green-400" />
                      Всього асистів
                    </span>
                    <span className="font-bold text-white">
                      {stats.total_assists || 0}
                    </span>
                  </div>
                  {isCS2 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 flex items-center gap-2">
                        <Crosshair size={16} className="text-yellow-500" />
                        Відсоток Headshots
                      </span>
                      <span className="font-bold text-white">
                        {stats.avg_headshots ? `${stats.avg_headshots}%` : "0%"}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* НИЖНЯ СЕКЦІЯ: ГРАФІК ЗМІНИ RATING ELO */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="text-esports-accent" /> Історія зміни рейтингу
          Elo
        </h3>

        {chartData.length < 2 ? (
          <div className="text-center py-10 text-slate-500 text-sm italic">
            Недостатньо зіграних матчів для побудови кривої прогресу рейтингу
            (потрібно хоча б 2 точки).
          </div>
        ) : (
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                {/* Прив'язуємо вісь до index, але ховаємо числові тіки, щоб вони не перевантажували UI */}
                <XAxis
                  dataKey="index"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  domain={["dataMin - 50", "dataMax + 50"]}
                  tickLine={false}
                />

                {/* Підключаємо наш кастомний інформативний підказчик */}
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: "#334155",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="Elo"
                  stroke="#F2A71B"
                  strokeWidth={3}
                  activeDot={{ r: 6, stroke: "#011F26", strokeWidth: 2 }}
                  dot={{
                    stroke: "#011F26",
                    strokeWidth: 2,
                    r: 4,
                    fill: "#F2A71B",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
