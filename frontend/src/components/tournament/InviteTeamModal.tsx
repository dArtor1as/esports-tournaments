import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MailPlus, Search, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface InviteTeamModalProps {
  tournamentId: string;
  tournamentTier: number;
  tournamentGameId: string;
}

export default function InviteTeamModal({
  tournamentId,
  tournamentTier,
  tournamentGameId,
}: InviteTeamModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: teamsData, isLoading: isLoadingTeams } = useQuery({
    queryKey: ["availableTeamsForInvite"],
    queryFn: async () => {
      const { data } = await api.get("/leaderboards/teams?limit=100");
      return data.data || [];
    },
    enabled: isOpen,
  });

  // ФІЛЬТРАЦІЯ КОМАНД ЗА ГРОЮ, ТІРОМ І ПОШУКОМ
  const filteredTeams =
    teamsData?.filter((team: any) => {
      // 1. АВТО-ФІЛЬТР: Перевіряємо повну відповідність гри (по gameId або вкладеному об'єкту)
      const matchesGame =
        team.gameId === tournamentGameId || team.game?.id === tournamentGameId;
      if (!matchesGame) return false;

      // 2. ФІЛЬТР ПО ТІРУ: Якщо обрано конкретний тір
      const matchesTier =
        tierFilter === "all" || team.tier === parseInt(tierFilter);
      if (!matchesTier) return false;

      // 3. ТЕКСТОВИЙ ПОШУК: За назвою або тегом
      const matchesSearch =
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.tag.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    }) || [];

  const handleInvite = async () => {
    if (!selectedTeamId) return;
    setIsLoading(true);
    try {
      await api.post("/tournament-invitations", {
        tournamentId,
        teamId: selectedTeamId,
      });
      toast.success("Офіційне запрошення успішно надіслано капітану команди!");
      setIsOpen(false);
      setSelectedTeamId("");
      setSearchTerm("");
      setTierFilter("all");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Не вдалося надіслати запрошення",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-wider text-xs h-8 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
          <MailPlus size={14} className="mr-2" /> Запросити команду
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-slate-900 border border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <MailPlus className="text-purple-500" /> Запрошення на турнір
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg flex items-start gap-3">
            <ShieldAlert
              size={18}
              className="text-purple-400 shrink-0 mt-0.5"
            />
            <div className="text-xs text-slate-300 space-y-1">
              <p>Відображаються лише команди тієї ж дисципліни, що й турнір.</p>
              <p className="font-bold text-purple-400">
                Правило: різниця в рейтингу не може перевищувати 1 Tier (Турнір
                Tier {tournamentTier}).
              </p>
            </div>
          </div>

          {/* БЛОК ФІЛЬТРІВ ТА ПОШУКУ */}
          <div className="space-y-3">
            <div className="flex gap-2">
              {/* Пошук назви/тегу */}
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={16}
                />
                <Input
                  placeholder="Назва або тег..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-800 h-9 text-xs"
                />
              </div>

              {/* ВИПАДАЮЧИЙ СПИСОК ФІЛЬТРУ ТІРІВ */}
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[120px] bg-slate-950 border-slate-800 text-slate-300 h-9 text-xs">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal size={12} className="text-slate-500" />
                    <SelectValue placeholder="Тір" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white text-xs">
                  <SelectItem value="all">Всі Тіри</SelectItem>
                  <SelectItem value="1">Tier 1</SelectItem>
                  <SelectItem value="2">Tier 2</SelectItem>
                  <SelectItem value="3">Tier 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Список команд з підсвічуванням вибору */}
            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {isLoadingTeams ? (
                <div className="text-center py-6 text-slate-500 text-sm animate-pulse">
                  Завантаження баз даних...
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm italic">
                  Нікого не знайдено за цими параметрами
                </div>
              ) : (
                filteredTeams.map((team: any) => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer border transition-colors ${selectedTeamId === team.id ? "bg-purple-600/20 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.15)]" : "bg-slate-950 border-slate-800/60 hover:border-slate-600"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-mono font-black text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                        [{team.tag}]
                      </span>
                      <span className="font-bold text-sm text-white">
                        {team.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] border-slate-700 text-slate-400 uppercase tracking-wider"
                    >
                      Tier {team.tier}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white text-xs font-bold"
          >
            Скасувати
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!selectedTeamId || isLoading}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase px-4"
          >
            {isLoading ? "Надсилання..." : "Надіслати інвайт"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
