import { useState } from "react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";

interface InvitePlayerModalProps {
  teamId: string;
}

export default function InvitePlayerModal({ teamId }: InvitePlayerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState("");

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInviteToken("");

    try {
      // Виклик POST /team-invitations
      const response = await api.post("/team-invitations", {
        teamId,
        userId: userId.trim(),
      });
      setInviteToken(response.data.token);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Не вдалося створити запрошення. Перевірте UUID користувача.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(val) => {
        setIsOpen(val);
        if (!val) {
          setInviteToken("");
          setUserId("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-esports-accent text-black hover:bg-esports-accent/90 font-black text-xs h-8">
          <UserPlus size={14} className="mr-1.5" /> Запросити гравця
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-esports-accent">
            Запросити в команду
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Введіть унікальний UUID користувача (User ID), щоб згенерувати
            інвайт-код.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGenerateInvite} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>UUID Користувача</Label>
            <Input
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          {!inviteToken && (
            <Button
              disabled={loading}
              type="submit"
              className="w-full bg-esports-primary text-white font-bold"
            >
              {loading ? "Генерація..." : "Створити інвайт токен"}
            </Button>
          )}
        </form>

        {inviteToken && (
          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wider">
              Токен успішно згенеровано:
            </p>
            <div className="bg-slate-900 p-2 rounded border border-slate-700 font-mono text-xs select-all text-center text-esports-light">
              {inviteToken}
            </div>
            <p className="text-[10px] text-slate-500">
              Передайте цей токен гравцю. Він зможе прийняти його через API або
              інтерфейс інвайтів.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
