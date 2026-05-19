import { useNavigate } from "react-router-dom";
import { User, Crown, Trash2, LogOut } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TeamRosterCardProps {
  player: any;
  team: any;
  currentUser: any;
  isCaptain: boolean;
  onKick: (playerId: string) => void;
  onLeave: (playerId: string) => void;
}

export default function TeamRosterCard({
  player,
  team,
  currentUser,
  isCaptain,
  onKick,
  onLeave,
}: TeamRosterCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isPlayerCaptain = team.captainId === player.id;
  const isMe = player.userId === currentUser?.id;

  // Функція для зміни ролі
  const handleRoleChange = async (newRole: string) => {
    try {
      await api.patch(`/teams/${team.id}/players/${player.id}/role`, {
        teamRole: newRole,
      });
      toast.success("Роль гравця успішно оновлено");
      queryClient.invalidateQueries({ queryKey: ["teamProfile", team.id] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Помилка при зміні ролі");
    }
  };

  return (
    <div
      onClick={() => navigate(`/player/${player.id}`)}
      className="w-full h-[260px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative cursor-pointer group hover:border-esports-primary hover:scale-[1.03] transition-all duration-300 shadow-md flex flex-col justify-between"
    >
      {isPlayerCaptain && (
        <div className="absolute top-2 left-2 z-20 bg-esports-accent/90 p-1 rounded shadow-md">
          <Crown size={12} className="text-black" />
        </div>
      )}

      <div className="absolute top-2 right-2 z-20 bg-slate-900/90 border border-slate-800/60 px-1.5 py-0.5 rounded text-[10px] font-black text-yellow-400">
        {player.rating}
      </div>

      <div className="w-full flex-1 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 pt-6 relative">
        {/* Іконка гравця замість аватарки */}
        <User
          size={95}
          className="text-slate-800 group-hover:text-slate-700 transition-colors"
          strokeWidth={1}
        />
        <div className="absolute bottom-0 left-0 w-full bg-slate-900/80 backdrop-blur-xs border-t border-slate-800/40 py-2 px-2 text-center group-hover:bg-esports-primary/30 transition-colors">
          <p className="font-black text-sm text-white truncate tracking-tight">
            {player.nickname}
          </p>
        </div>
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center z-20">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 font-black uppercase">
            Роль у команді
          </span>

          {/* Якщо я капітан і це не моя картка — показуємо селект для зміни ролі */}
          {isCaptain && !isPlayerCaptain ? (
            <div onClick={(e) => e.stopPropagation()} className="mt-1">
              <Select
                defaultValue={player.teamRole || "PLAYER"}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger className="h-7 text-xs bg-slate-800 border-slate-700 text-white w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="PLAYER">Гравець</SelectItem>
                  <SelectItem value="COACH">Тренер</SelectItem>
                  <SelectItem value="SUBSTITUTE">Заміна</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <span className="text-[11px] text-esports-accent font-bold uppercase truncate">
              {player.teamRole || "PLAYER"}
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-900 p-2 flex items-center justify-between gap-1 border-t border-slate-800/60 h-10">
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

        <div className="flex gap-1">
          {!isCaptain && isMe && (
            <ConfirmModal
              title="Покинути команду?"
              description="Ви перейдете в статус вільного агента."
              onConfirm={() => onLeave(player.id)}
              confirmText="Покинути"
            >
              <button
                onClick={(e) => e.stopPropagation()}
                className="text-orange-500 hover:text-orange-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-orange-500/10"
              >
                <LogOut size={14} />
              </button>
            </ConfirmModal>
          )}

          {isCaptain && !isPlayerCaptain && (
            <ConfirmModal
              title="Вилучити гравця?"
              description={`Ви впевнені, що хочете кікнути ${player.nickname}?`}
              onConfirm={() => onKick(player.id)}
              confirmText="Вилучити"
            >
              <button
                onClick={(e) => e.stopPropagation()}
                className="text-red-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-red-500/10"
              >
                <Trash2 size={14} />
              </button>
            </ConfirmModal>
          )}
        </div>
      </div>
    </div>
  );
}
