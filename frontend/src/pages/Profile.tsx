import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Trophy, Shield, Swords, ArrowRight } from "lucide-react";
import CreatePlayerModal from "@/components/CreatePlayerModal";
import EditProfileModal from "@/components/EditProfileModal";
import EditPlayerModal from "@/components/EditPlayerModal";
import CreateTeamModal from "@/components/CreateTeamModal";
// ХЕЛПЕР ДЛЯ ВІКУ
const calculateAge = (dateString?: string) => {
  if (!dateString) return null;
  const today = new Date();
  const birthDate = new Date(dateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isMyProfile = currentUser?.id === id;

  // 1. Запит для даних користувача (User)
  const {
    data: userData,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      const endpoint = isMyProfile ? "/users/me" : `/users/${id}`;
      const { data } = await api.get(endpoint);
      return data;
    },
    enabled: !!id, // Запускати запит тільки якщо є id
  });

  // 2. Запит для ігрових профілів (Players)
  const { data: playerProfiles = [], isLoading: isPlayersLoading } = useQuery({
    queryKey: ["players", id],
    queryFn: async () => {
      // Поки бекенд підтримує тільки /players/me для себе
      if (!isMyProfile) return [];
      const { data } = await api.get("/players/me");
      return data;
    },
    enabled: !!id && isMyProfile, // Запускати тільки для свого профілю
  });

  const isLoading = isUserLoading || isPlayersLoading;

  // Функція для оновлення даних після редагування (інвалідація кешу)
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["user", id] });
    queryClient.invalidateQueries({ queryKey: ["players", id] });
  };

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-64 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження профілю...
      </div>
    );

  if (isUserError || !userData)
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-2xl font-bold text-red-500">Профіль не знайдено</h2>
        <button
          onClick={() => navigate("/")}
          className="text-esports-accent underline hover:text-white"
        >
          Повернутися на головну
        </button>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Card className="bg-slate-900 border-slate-800 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-esports-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <CardContent className="flex items-center gap-6 p-6 relative z-10">
          <UserCircle
            size={80}
            className="text-esports-muted"
            strokeWidth={1}
          />
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-esports-light flex items-center gap-3">
              {/* ПРАПОР ПЕРЕД НІКНЕЙМОМ */}
              {userData.countryCode && (
                <img
                  src={`https://flagcdn.com/w40/${userData.countryCode.toLowerCase()}.png`}
                  srcSet={`https://flagcdn.com/w80/${userData.countryCode.toLowerCase()}.png 2x`}
                  width="40"
                  alt={userData.countryCode}
                  className="rounded-sm shadow-sm inline-block mr-1 align-middle border border-slate-800"
                  title={userData.countryCode}
                />
              )}
              {userData.username}
              {userData.role === "ADMIN" && (
                <Badge className="bg-red-500 text-white border-none text-xs ml-2 align-middle">
                  ADMIN
                </Badge>
              )}
            </h1>

            {/* EMAIL І ВІК */}
            <p className="text-esports-muted mt-2 font-medium flex items-center gap-2">
              {userData.email}
              {userData.birthDate && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">
                    {calculateAge(userData.birthDate)} years
                  </span>
                </>
              )}
            </p>
          </div>
          {isMyProfile && (
            <EditProfileModal user={userData} onSuccess={refreshData} />
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-esports-light flex items-center gap-2">
            <Swords className="text-esports-primary" />
            Ігрові профілі
          </h2>
          {isMyProfile && <CreatePlayerModal onSuccess={refreshData} />}
        </div>

        {playerProfiles.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800 border-dashed">
            <CardContent className="text-center py-10 text-esports-muted">
              У {isMyProfile ? "вас" : "цього користувача"} ще немає ігрових
              профілів.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {playerProfiles.map((player: any) => (
              <Card
                key={player.id}
                onClick={() => navigate(`/player/${player.id}`)}
                className="bg-slate-900 border-slate-800 text-white transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-esports-primary/20 hover:-translate-y-1 hover:border-esports-primary cursor-pointer group flex flex-col min-h-[220px]"
              >
                <CardHeader className="pb-3 flex-none">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl text-white group-hover:text-esports-light transition-colors">
                        {player.nickname}
                      </CardTitle>
                      <CardDescription className="mt-2 inline-block bg-esports-accent/10 border border-esports-accent/20 text-esports-accent uppercase text-sm font-black tracking-widest px-2.5 py-0.5 rounded">
                        {player.game.name}
                      </CardDescription>
                    </div>

                    {/* Контейнер для ролі та кнопки налаштувань */}
                    <div className="flex items-center gap-2">
                      {player.inGameRole && (
                        <Badge className="bg-esports-accent text-black font-black border-none px-3 py-1 text-xs">
                          {player.inGameRole}
                        </Badge>
                      )}

                      {/* Показуємо кнопку редагування ТІЛЬКИ якщо це наш профіль */}
                      {isMyProfile && (
                        <EditPlayerModal
                          player={player}
                          onSuccess={refreshData}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 flex-grow flex flex-col justify-end">
                  <div className="flex items-center justify-between p-4 bg-slate-950/80 rounded-xl border border-slate-800/50">
                    <span className="text-slate-400 font-medium uppercase tracking-wider text-xs">
                      Рейтинг Elo
                    </span>
                    <div className="flex items-center gap-2">
                      <Trophy
                        size={24}
                        className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                      />
                      <span className="font-black text-3xl text-yellow-400 tracking-tight drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                        {player.rating}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 truncate w-full">
                      <Shield
                        size={16}
                        className="text-slate-500 flex-shrink-0"
                      />
                      {player.team ? (
                        // ТУТ МИ РОБИМО КОМАНДУ КЛІКАБЕЛЬНОЮ З ВЛАСНИМ ХОВЕРОМ
                        <div
                          onClick={(e) => {
                            e.stopPropagation(); // Зупиняємо перехід на сторінку гравця
                            navigate(`/team/${player.team.id}`); // Переходимо на сторінку команди
                          }}
                          className="font-bold text-esports-light flex items-center gap-2 truncate cursor-pointer hover:text-esports-accent hover:bg-slate-800/80 px-2 py-1 -ml-2 rounded transition-colors w-full"
                        >
                          <span className="text-slate-500 font-normal group-hover/team:text-slate-400 transition-colors">
                            [{player.team.tag}]
                          </span>
                          <span className="truncate">{player.team.name}</span>
                        </div>
                      ) : (
                        <div className="text-sm italic text-esports-muted px-2 py-1 w-full">
                          Вільний агент
                        </div>
                      )}
                    </div>
                    {/* КНОПКА СТВОРЕННЯ КОМАНДИ */}
                    {!player.team && isMyProfile && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <CreateTeamModal
                          player={player}
                          onSuccess={refreshData}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <span className="text-esports-muted group-hover:text-esports-accent transition-colors text-sm font-semibold flex items-center gap-1">
                      Повна статистика{" "}
                      <ArrowRight
                        size={18}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
