import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MailOpen, Check, X } from 'lucide-react';

export default function AcceptTeamInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [playerId, setPlayerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Завантажуємо ігрові профілі поточного юзера
  const { data: myPlayers = [], isLoading } = useQuery({
    queryKey: ['myPlayersForInvite'],
    queryFn: async () => {
      const { data } = await api.get('/players/me');
      // Фільтруємо тих, хто ще не в команді
      return data.filter((p: any) => !p.teamId);
    },
  });

  const handleAccept = async () => {
    if (!playerId) {
      setError('Оберіть ігровий профіль, яким хочете вступити.');
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/team-invitations/${token}/accept`, { playerId });
      navigate('/teams'); // Після успіху кидаємо на список команд
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Помилка прийому інвайту. Можливо токен прострочений.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await api.patch(`/team-invitations/${token}/decline`);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка відхилення інвайту.');
    } finally {
      setLoading(false);
    }
  };

  if (!token)
    return (
      <div className="text-center py-20 text-red-500">Токен не знайдено.</div>
    );

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-esports-primary/20 rounded-full flex items-center justify-center mb-2">
            <MailOpen className="text-esports-primary" size={24} />
          </div>
          <CardTitle className="text-2xl text-esports-accent">
            Запрошення в команду
          </CardTitle>
          <CardDescription className="text-slate-400">
            Оберіть свій вільний ігровий профіль, щоб приєднатися.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-center text-slate-500 animate-pulse">
              Перевірка ваших профілів...
            </p>
          ) : (
            <div className="space-y-2">
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Оберіть свій профіль..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {myPlayers.length === 0 && (
                    <div className="p-2 text-sm text-slate-500">
                      У вас немає вільних профілів.
                    </div>
                  )}
                  {myPlayers.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nickname} ({p.game.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm font-bold text-center">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleDecline}
              disabled={loading}
              variant="outline"
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <X size={16} className="mr-2" /> Відхилити
            </Button>
            <Button
              onClick={handleAccept}
              disabled={loading || !playerId}
              className="w-full bg-green-600 hover:bg-green-500 text-white"
            >
              <Check size={16} className="mr-2" /> Прийняти
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
