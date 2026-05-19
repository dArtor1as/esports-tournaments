import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AcceptInviteModalProps {
  invite: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PlayerSelection = {
  playerId: string;
  role: "PLAYER" | "CAPTAIN" | "COACH" | "SUBSTITUTE" | "NONE";
};

export default function AcceptInviteModal({
  invite,
  isOpen,
  onClose,
  onSuccess,
}: AcceptInviteModalProps) {
  const [selections, setSelections] = useState<
    Record<string, PlayerSelection["role"]>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["team", invite?.teamId],
    queryFn: async () => (await api.get(`/teams/${invite?.teamId}`)).data,
    enabled: !!invite?.teamId && isOpen,
  });

  const players = teamData?.players || [];

  const handleRoleChange = (
    playerId: string,
    role: PlayerSelection["role"],
  ) => {
    setSelections((prev) => ({ ...prev, [playerId]: role }));
  };

  // Автоматичне призначення ролей при першому відкритті модалки
  useEffect(() => {
    if (players.length > 0 && Object.keys(selections).length === 0) {
      const initial: Record<
        string,
        "PLAYER" | "CAPTAIN" | "COACH" | "SUBSTITUTE" | "NONE"
      > = {};

      players.forEach((p: any) => {
        if (p.id === teamData?.captainId) {
          initial[p.id] = "CAPTAIN";
        } else if (
          p.inGameRole === "COACH" ||
          p.role === "COACH" ||
          p.player?.inGameRole === "COACH"
        ) {
          initial[p.id] = "COACH";
        } else {
          initial[p.id] = "NONE";
        }
      });

      setSelections(initial);
    }
  }, [players, teamData, selections]);

  // Валідація складу перед відправкою
  const rosterMetrics = useMemo(() => {
    const values = Object.values(selections);
    const active = values.filter(
      (v) => v === "PLAYER" || v === "CAPTAIN",
    ).length;
    const coach = values.filter((v) => v === "COACH").length;
    const sub = values.filter((v) => v === "SUBSTITUTE").length;
    return { active, coach, sub };
  }, [selections]);

  const isValid =
    rosterMetrics.active === 5 &&
    rosterMetrics.coach <= 1 &&
    rosterMetrics.sub <= 1;

  const handleAccept = async () => {
    if (!isValid) return;

    const rosterPlayers = Object.entries(selections)
      .filter(([_, role]) => role !== "NONE")
      .map(([playerId, role]) => ({ playerId, role }));

    setIsLoading(true);
    try {
      await api.patch(`/tournament-invitations/${invite.token}/accept`, {
        rosterPlayers,
      });
      toast.success("Ви успішно укомплектували склад та прийняли інвайт!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Помилка авторизації складу");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" /> Затвердження складу
            команди
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-400">
            Розподіліть ролі для офіційної заявки на турнір. Потрібно обрати{" "}
            <strong className="text-white">рівно 5 активних гравців</strong>.
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} /> Гравці {invite?.team?.name}
            </h4>

            {isLoadingTeam ? (
              <div className="animate-pulse text-sm text-slate-500 py-4">
                Синхронізація гравців...
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {players.map((player: any) => {
                  const currentRole = selections[player.id] || "NONE";
                  // Блокуємо зміну селектора для Коуча та Капітана
                  const isLockedRole =
                    currentRole === "COACH" || currentRole === "CAPTAIN";

                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800/80"
                    >
                      <span className="font-bold text-sm text-white pl-1">
                        {player.nickname}
                      </span>

                      <Select
                        value={currentRole}
                        onValueChange={(val: any) =>
                          handleRoleChange(player.id, val)
                        }
                        disabled={isLockedRole}
                      >
                        <SelectTrigger
                          className={`w-[150px] bg-slate-950 border-slate-800 text-xs h-8 ${isLockedRole ? "opacity-75 text-amber-400 font-bold border-amber-500/20" : "text-slate-300"}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-white text-xs">
                          <SelectItem value="NONE">Не бере участі</SelectItem>
                          <SelectItem value="PLAYER">
                            Основний гравець
                          </SelectItem>
                          <SelectItem value="CAPTAIN">
                            Капітан складу
                          </SelectItem>
                          <SelectItem value="SUBSTITUTE">
                            Заміна (Substitute)
                          </SelectItem>
                          <SelectItem value="COACH">Тренер (Coach)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* МЕТРИКИ ВАЛІДАЦІЇ */}
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex justify-between text-[11px] font-black uppercase tracking-wider">
            <span
              className={
                rosterMetrics.active === 5
                  ? "text-emerald-400"
                  : "text-slate-500"
              }
            >
              Активні: {rosterMetrics.active} / 5
            </span>
            <span
              className={
                rosterMetrics.sub <= 1 ? "text-slate-400" : "text-red-400"
              }
            >
              Заміна: {rosterMetrics.sub} / 1
            </span>
            <span
              className={
                rosterMetrics.coach <= 1 ? "text-slate-400" : "text-red-400"
              }
            >
              Тренер: {rosterMetrics.coach} / 1
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 text-xs font-bold"
          >
            Скасувати
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isLoading || !isValid}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase px-5"
          >
            {isLoading ? "Реєстрація..." : "Підтвердити заявку"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
