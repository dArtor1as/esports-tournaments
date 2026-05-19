import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';

interface InvitePlayerModalProps {
  teamId: string;
}

export default function InvitePlayerModal({ teamId }: InvitePlayerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [playerNickname, setPlayerNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInviteToken('');

    try {
      // Відправляємо playerNickname
      const response = await api.post('/team-invitations', {
        teamId,
        playerNickname: playerNickname.trim(),
      });
      setInviteToken(response.data.token);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Не вдалося створити запрошення. Перевірте логін.',
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
          setInviteToken('');
          setPlayerNickname('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-esports-accent text-black hover:bg-esports-accent/90 font-black text-xs h-8">
          <UserPlus size={14} className="mr-1.5" /> Запросити гравця
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-esports-accent">
            Запросити в команду
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Введіть{' '}
            <span className="text-white font-bold">логін (playerNickname)</span>{' '}
            користувача, щоб згенерувати для нього інвайт.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGenerateInvite} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Логін (playerNickname) гравця</Label>
            <Input
              required
              value={playerNickname}
              onChange={(e) => setPlayerNickname(e.target.value)}
              placeholder="Наприклад: s1mple"
              className="bg-slate-800 border-slate-700 text-white font-medium"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          {!inviteToken && (
            <Button
              disabled={loading}
              type="submit"
              className="w-full bg-esports-primary text-white font-bold"
            >
              {loading ? 'Пошук гравця...' : 'Згенерувати інвайт'}
            </Button>
          )}
        </form>

        {inviteToken && (
          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 animate-in fade-in zoom-in duration-300">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wider">
              Гравця знайдено! Токен згенеровано:
            </p>
            <div className="bg-slate-900 p-2 rounded border border-slate-700 font-mono text-xs select-all text-center text-esports-light">
              {inviteToken}
            </div>
            <p className="text-[10px] text-slate-500">
              Надішліть цей токен гравцю, щоб він міг приєднатися до ростера.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
