import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";

interface AcceptInviteModalProps {
  invite: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AcceptInviteModal({
  invite,
  isOpen,
  onClose,
  onSuccess,
}: AcceptInviteModalProps) {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Завантажуємо повний профіль команди, щоб отримати її гравців
  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["team", invite?.teamId],
    queryFn: async () => (await api.get(`/teams/${invite?.teamId}`)).data,
    enabled: !!invite?.teamId && isOpen,
  });

  const players = teamData?.players || [];

  const handleTogglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId],
    );
  };

  const handleAccept = async () => {
    if (selectedPlayerIds.length < 1 || selectedPlayerIds.length > 7) {
      return toast.error(
        "Оберіть від 1 до 7 гравців (включно із замінами та тренером).",
      );
    }

    setIsLoading(true);
    try {
      await api.patch(`/tournament-invitations/${invite.token}/accept`, {
        rosterPlayerIds: selectedPlayerIds,
      });
      toast.success("Ви успішно зареєстрували команду на турнір!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Помилка при прийнятті інвайту",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" /> Підтвердження участі
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-300">
            Для участі в{" "}
            <strong className="text-white">{invite?.tournament?.title}</strong>{" "}
            необхідно затвердити активний ростер (від 5 до 7 учасників).
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} /> Склад команди {invite?.team?.name}
            </h4>

            {isLoadingTeam ? (
              <div className="animate-pulse text-sm text-slate-500">
                Завантаження гравців...
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {players.map((player: any) => (
                  <div
                    key={player.id}
                    className="flex items-center space-x-3 bg-slate-900 p-2.5 rounded border border-slate-800"
                  >
                    <Checkbox
                      id={player.id}
                      checked={selectedPlayerIds.includes(player.id)}
                      onCheckedChange={() => handleTogglePlayer(player.id)}
                      className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <label
                      htmlFor={player.id}
                      className="flex-1 cursor-pointer flex justify-between items-center text-sm"
                    >
                      <span className="font-bold text-white">
                        {player.nickname}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-black">
                        {player.inGameRole || "Player"}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-right text-slate-400">
            Обрано гравців:{" "}
            <strong
              className={
                selectedPlayerIds.length >= 5 && selectedPlayerIds.length <= 7
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            >
              {selectedPlayerIds.length}
            </strong>{" "}
            / 7
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Скасувати
          </Button>
          <Button
            onClick={handleAccept}
            disabled={
              isLoading ||
              selectedPlayerIds.length < 1 ||
              selectedPlayerIds.length > 7
            }
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            {isLoading ? "Обробка..." : "Підтвердити склад"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
