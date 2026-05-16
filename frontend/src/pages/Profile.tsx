import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Swords } from "lucide-react";
import CreatePlayerModal from "@/components/CreatePlayerModal";
import EditProfileModal from "@/components/EditProfileModal";
import PlayerProfileCard from "@/components/PlayerProfileCard";

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
              <PlayerProfileCard
                key={player.id}
                player={player}
                isMyProfile={isMyProfile}
                refreshData={refreshData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
