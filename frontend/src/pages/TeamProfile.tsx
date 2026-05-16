import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Trophy,
  Users,
  Shield,
  Trash2,
  Crown,
  User,
} from "lucide-react";
import InvitePlayerModal from "@/components/InvitePlayerModal";

export default function TeamProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Завантаження профілю команди
  const { data: team, isLoading } = useQuery({
    queryKey: ["teamProfile", id],
    queryFn: async () => {
      const { data } = await api.get(`/teams/${id}`);
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження профілю команди...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-20 text-red-500 font-bold">
        Команду не знайдено.
      </div>
    );
  }

  // Визначаємо права та ролі
  const isCaptain = team.captain?.userId === currentUser?.id;

  // Фільтруємо звичайних гравців та коуча (згідно з RosterRole або вашим полем ролі)
  // Якщо у вас коуч лежить у масиві players з окремим статусом, відфільтруємо його
  const activePlayers =
    team.players?.filter((p: any) => p.inGameRole?.toUpperCase() !== "COACH") ||
    [];
  const coach = team.players?.find(
    (p: any) => p.inGameRole?.toUpperCase() === "COACH",
  );

  const handleDisband = async () => {
    if (!window.confirm("УВАГА! Це безповоротно видалить команду. Продовжити?"))
      return;
    try {
      await api.delete(`/teams/${id}`);
      navigate("/teams");
    } catch (err: any) {
      alert(err.response?.data?.message || "Помилка при видаленні");
    }
  };

  const handleKick = async (playerId: string) => {
    if (!window.confirm("Вилучити гравця зі складу?")) return;
    try {
      await api.delete(`/teams/${id}/kick/${playerId}`);
      queryClient.invalidateQueries({ queryKey: ["teamProfile", id] });
    } catch (err: any) {
      alert(err.response?.data?.message || "Помилка при виключенні");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate("/teams")}
        className="text-slate-400 hover:text-white mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> До списку команд
      </Button>

      {/* ВЕРХНІЙ БАНЕР КОМАНДИ */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 left-0 w-96 h-full bg-gradient-to-r from-esports-primary/10 to-transparent pointer-events-none"></div>

        <div className="flex items-center gap-5 relative z-10">
          <div className="w-20 h-20 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center font-black text-2xl text-esports-accent shadow-inner">
            {team.tag}
          </div>
          <div>
            <div className="flex items-center gap-3">
              {/* ПРАПОР ПЕРЕД НАЗВОЮ КОМАНДИ */}
              {team.countryCode && team.countryCode !== "INT" && (
                <img
                  src={`https://flagcdn.com/w40/${team.countryCode.toLowerCase()}.png`}
                  width="36"
                  alt={team.countryCode}
                  className="rounded shadow-sm border border-slate-950 align-middle"
                />
              )}
              <h1 className="text-3xl font-black text-white">{team.name}</h1>
              <Badge className="bg-esports-primary/20 text-esports-light border-esports-primary/30 uppercase tracking-widest text-[10px]">
                {team.game?.name}
              </Badge>
            </div>
            <p className="text-sm text-slate-400 mt-1 flex items-center gap-4">
              <span>
                Регіон: <strong className="text-white">{team.region}</strong>
              </span>
              <span>
                Тір:{" "}
                <strong className="text-esports-accent">
                  Tier {team.tier}
                </strong>
              </span>
              <span>
                Статус:{" "}
                <strong
                  className={
                    team.isComplete ? "text-green-400" : "text-yellow-400"
                  }
                >
                  {team.isComplete ? "Повний склад" : "Шукають гравців"}
                </strong>
              </span>
            </p>
          </div>
        </div>

        {isCaptain && (
          <Button
            onClick={handleDisband}
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 text-xs font-bold"
          >
            <Trash2 size={14} className="mr-1.5" /> Розформувати команду
          </Button>
        )}
      </div>

      {/* ПАНЕЛЬ УПРАВЛІННЯ ІНВАЙТАМИ (ТІЛЬКИ ДЛЯ КАПІТАНА) */}
      {isCaptain && (
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
          <div>
            <h4 className="text-sm font-black text-esports-accent uppercase tracking-wider">
              Панель управління капітана
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Ви можете згенерувати токен запрошення, щоб доукомплектувати
              ростер.
            </p>
          </div>
          <InvitePlayerModal teamId={team.id} />
        </div>
      )}

      {/* ОГЛЯД СТАТУСУ ТА КАПІТАНА */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-xl">
          <div className="text-left">
            <span className="text-xs text-slate-500 uppercase font-black tracking-wider block">
              Командний Elo
            </span>
            <span className="text-3xl font-black text-yellow-400 mt-1 block">
              {team.averageRating}
            </span>
          </div>
          <Trophy
            size={28}
            className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.3)]"
          />
        </div>

        {/* ТУТ ВИПРАВЛЕНО: ДАНІ КАПІТАНА ТЕПЕР ПІДТЯГУЮТЬСЯ І ПОКАЗУЮТЬ ПРАПОР */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-xl md:col-span-2">
          <div className="text-left">
            <span className="text-xs text-slate-500 uppercase font-black tracking-wider block">
              Капітан команди
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              {team.captain?.user?.countryCode && (
                <img
                  src={`https://flagcdn.com/w20/${team.captain.user.countryCode.toLowerCase()}.png`}
                  width="20"
                  alt="Flag"
                  className="rounded-sm"
                />
              )}
              <span className="text-lg font-bold text-white">
                {team.captain ? (
                  team.captain.nickname
                ) : (
                  <span className="text-slate-600 italic">Не призначено</span>
                )}
              </span>
            </div>
          </div>
          <Crown size={28} className="text-esports-accent" />
        </div>
      </div>

      {/* СЕКЦІЯ РОСТЕРА (ЯК НА HLTV) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <h3 className="text-xl font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Users size={20} className="text-esports-primary" /> Активний ростер
        </h3>

        {/* РЯД ГРАВЦІВ (FLEX-ROW) */}
        <div className="flex flex-wrap gap-4 justify-start">
          {activePlayers.length === 0 && (
            <p className="text-slate-500 text-sm italic py-4">
              У складі команди немає активних гравців.
            </p>
          )}
          {activePlayers.map((player: any) => {
            const isPlayerCaptain = team.captainId === player.id;

            return (
              <div
                key={player.id}
                onClick={() => navigate(`/player/${player.id}`)} // ПЕРЕХІД НА ІГРОВИЙ ПРОФІЛЬ ГРАВЦЯ
                className="w-[160px] h-[210px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative cursor-pointer group hover:border-esports-primary hover:scale-[1.03] transition-all duration-300 shadow-md flex flex-col justify-between"
              >
                {/* Капітанська корона зверху картки */}
                {isPlayerCaptain && (
                  <div className="absolute top-2 left-2 z-20 bg-esports-accent/90 p-1 rounded shadow-md">
                    <Crown size={12} className="text-black" />
                  </div>
                )}

                {/* Показник ELO у кутку картки */}
                <div className="absolute top-2 right-2 z-20 bg-slate-900/90 border border-slate-800/60 px-1.5 py-0.5 rounded text-[10px] font-black text-yellow-400">
                  {player.rating}
                </div>

                {/* ТІЛО КАРТКИ: Великий силует аватара */}
                <div className="w-full flex-1 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 pt-6 relative">
                  <User
                    size={85}
                    className="text-slate-800 group-hover:text-slate-700 transition-colors"
                    strokeWidth={1}
                  />

                  {/* НІКНЕЙМ НА НАПІВПРОЗОРОМУ ФОНІ ПОВЕРХ АВАТАРА */}
                  <div className="absolute bottom-0 left-0 w-full bg-slate-900/80 backdrop-blur-xs border-t border-slate-800/40 py-1.5 px-2 text-center group-hover:bg-esports-primary/30 transition-colors">
                    <p className="font-black text-sm text-white truncate tracking-tight">
                      {player.nickname}
                    </p>
                  </div>
                </div>

                {/* ПІДВАЛ КАРТКИ: Прапор країни та роль */}
                <div className="bg-slate-900 p-2 flex items-center justify-between gap-1 border-t border-slate-800/60 h-9">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {player.user?.countryCode ? (
                      <img
                        src={`https://flagcdn.com/w20/${player.user.countryCode.toLowerCase()}.png`}
                        width="18"
                        alt="Flag"
                        className="rounded-xs flex-shrink-0"
                      />
                    ) : (
                      <div className="w-4 h-3 bg-slate-800 rounded-xs flex-shrink-0" />
                    )}
                    <span className="text-[10px] text-slate-400 font-bold uppercase truncate">
                      {player.inGameRole || "Player"}
                    </span>
                  </div>

                  {/* Кнопка швидкого кіку для капітана (з'являється при наведенні на картку) */}
                  {isCaptain && !isPlayerCaptain && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Зупиняємо перехід за посиланням
                        handleKick(player.id);
                      }}
                      className="text-red-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Виключити з команди"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* СЕКЦІЯ ТРЕНЕРА (КОУЧА) ОКРЕМO ЗНИЗУ */}
        <div className="border-t border-slate-800/80 pt-6">
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 max-w-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <Shield size={20} />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">
                  Головний тренер
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {coach?.user?.countryCode && (
                    <img
                      src={`https://flagcdn.com/w20/${coach.user.countryCode.toLowerCase()}.png`}
                      width="16"
                      alt="Flag"
                    />
                  )}
                  <span
                    className={`font-bold ${coach ? "text-white text-base" : "text-slate-600 text-sm italic"}`}
                  >
                    {coach ? coach.nickname : "Місце вільне"}
                  </span>
                </div>
              </div>
            </div>

            {coach && (
              <div className="text-right">
                <span className="text-[9px] text-slate-500 uppercase font-black block">
                  Rating
                </span>
                <span className="text-sm font-black text-yellow-500 mt-0.5 block">
                  {coach.rating} ELO
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
