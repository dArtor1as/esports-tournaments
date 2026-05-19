// src/components/tournament/RegisterTeamModal.tsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ShieldAlert, UserPlus } from 'lucide-react';

interface RegisterTeamModalProps {
  tournament: any;
  isFull: boolean;
}

export default function RegisterTeamModal({
  tournament,
  isFull,
}: RegisterTeamModalProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Шукаємо всі профілі поточного юзера
  const { data: myProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['myProfilesForRegistration'],
    queryFn: async () => (await api.get('/players/me')).data,
    enabled: isOpen, // Завантажуємо тільки коли відкрили модалку
  });

  // 2. Шукаємо профіль-капітана для ТІЄЇ Ж дисципліни, що й турнір
  const captainProfile = myProfiles.find(
    (p: any) =>
      (p.gameId === tournament.gameId || p.game?.id === tournament.gameId) &&
      p.teamRole === 'CAPTAIN' &&
      p.teamId,
  );

  // 3. Якщо знайшли команду, завантажуємо її повний склад
  const { data: teamDetails, isLoading: teamLoading } = useQuery({
    queryKey: ['teamDetailsForRegistration', captainProfile?.teamId],
    queryFn: async () =>
      (await api.get(`/teams/${captainProfile.teamId}`)).data,
    enabled: !!captainProfile?.teamId && isOpen,
  });

  // Автоматично вибираємо 5 гравців основи при завантаженні команди
  useEffect(() => {
    if (teamDetails?.players) {
      const defaultRoster = teamDetails.players
        .filter((p: any) => p.teamRole === 'PLAYER' || p.teamRole === 'CAPTAIN')
        .map((p: any) => p.id);
      setSelectedPlayers(defaultRoster);
    }
  }, [teamDetails]);

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId],
    );
  };

  const handleRegister = async () => {
    if (selectedPlayers.length < 5) {
      return toast.error('Для участі необхідно обрати мінімум 5 гравців');
    }
    if (selectedPlayers.length > 7) {
      return toast.error(
        'Максимальний розмір заявки - 7 гравців (5 основи + тренер + заміна)',
      );
    }

    setLoading(true);
    try {
      await api.post('/tournament-participants', {
        tournamentId: tournament.id,
        teamId: captainProfile.teamId,
        rosterPlayerIds: selectedPlayers, // Відправляємо обраний склад
      });
      toast.success('Команду успішно зареєстровано на турнір!');
      setIsOpen(false);
      queryClient.invalidateQueries({
        queryKey: ['tournamentParticipants', tournament.id],
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка при реєстрації');
    } finally {
      setLoading(false);
    }
  };

  if (isFull) return null; // Якщо турнір заповнений, кнопку не малюємо

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-xs">
          <UserPlus size={16} className="mr-2" /> Реєстрація на турнір
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            Реєстрація команди
          </DialogTitle>
        </DialogHeader>

        {profilesLoading || teamLoading ? (
          <div className="py-10 text-center text-slate-500 animate-pulse">
            Перевірка даних...
          </div>
        ) : !captainProfile ? (
          <div className="py-6 text-center space-y-3">
            <ShieldAlert size={40} className="mx-auto text-yellow-500" />
            <p className="text-slate-300">
              Ви не можете зареєструватися, оскільки{' '}
              <strong>не є капітаном</strong> жодної команди в дисципліні{' '}
              <strong>{tournament.game?.name}</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">
                Ваша команда
              </p>
              <p className="font-black text-lg text-esports-primary">
                [{teamDetails?.tag}] {teamDetails?.name}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-300">
                Оберіть турнірний склад (від 5 до 7 осіб):
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {teamDetails?.players?.map((player: any) => (
                  <label
                    key={player.id}
                    className="flex items-center space-x-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
                  >
                    <Checkbox
                      checked={selectedPlayers.includes(player.id)}
                      onCheckedChange={() => togglePlayer(player.id)}
                      className="border-slate-500 data-[state=checked]:bg-esports-primary"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">
                        {player.nickname}
                      </span>
                      <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                        {player.teamRole}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-esports-primary hover:bg-esports-primary/90 text-white font-black uppercase"
            >
              {loading
                ? 'Реєстрація...'
                : `Заявити ростер (${selectedPlayers.length} гравців)`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
