import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings } from 'lucide-react';

const ROLES: Record<string, string[]> = {
  cs2: ['SNIPER', 'RIFLER', 'ENTRY', 'SUPPORT', 'IGL'],
  dota2: ['POS_1', 'POS_2', 'POS_3', 'POS_4', 'POS_5'],
};

interface EditPlayerModalProps {
  player: {
    id: string;
    nickname: string;
    inGameRole: string;
    game: { slug: string };
  };
  onSuccess: () => void;
}

export default function EditPlayerModal({
  player,
  onSuccess,
}: EditPlayerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [nickname, setNickname] = useState(player.nickname);
  const [inGameRole, setInGameRole] = useState(player.inGameRole || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.patch(`/players/${player.id}`, {
        nickname,
        // Якщо роль пуста, не відправляємо її (або відправляємо null, залежить від бекенду)
        ...(inGameRole && { inGameRole }),
      });
      setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Помилка оновлення ігрового профілю',
      );
    } finally {
      setLoading(false);
    }
  };

  const gameRoles = ROLES[player.game.slug] || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Зупиняємо подію кліку, щоб не спрацював перехід на сторінку статистики */}
      <div onClick={(e) => e.stopPropagation()}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-esports-accent hover:bg-slate-800 rounded-full"
          >
            <Settings size={16} />
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent
        className="bg-slate-900 border-slate-700 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-esports-accent">
            Редагувати ігровий профіль
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Ігровий нікнейм</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
              required
              maxLength={30}
            />
          </div>

          {gameRoles.length > 0 && (
            <div className="space-y-2">
              <Label>Ігрова роль</Label>
              <Select value={inGameRole} onValueChange={setInGameRole}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Оберіть роль" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {gameRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            disabled={loading}
            type="submit"
            className="w-full bg-esports-primary hover:bg-esports-primary/90 text-white"
          >
            {loading ? 'Збереження...' : 'Зберегти зміни'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
