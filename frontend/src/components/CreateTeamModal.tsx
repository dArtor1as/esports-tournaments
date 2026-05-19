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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldPlus } from 'lucide-react';

interface CreateTeamModalProps {
  player: {
    id: string;
    nickname: string;
    game: { name: string; slug: string };
  };
  onSuccess: () => void;
}

const REGIONS = ['EU', 'NA', 'CIS', 'ASIA', 'SA', 'GLOBAL'];

export default function CreateTeamModal({
  player,
  onSuccess,
}: CreateTeamModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [region, setRegion] = useState('GLOBAL');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/teams', {
        name,
        tag: tag.toUpperCase(),
        region,
        captainPlayerId: player.id, // Автоматично підставляємо ID гравця
      });
      setIsOpen(false);
      setName('');
      setTag('');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка при створенні команди');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {/* Кнопка зупиняє спливання події кліку, щоб не відкривалась статистика */}
        <Button
          onClick={(e) => e.stopPropagation()}
          className="bg-esports-primary hover:bg-esports-primary/90 text-white text-xs h-8 font-bold"
        >
          <ShieldPlus size={14} className="mr-1.5" /> Створити команду
        </Button>
      </DialogTrigger>

      <DialogContent
        className="bg-slate-900 border-slate-700 text-white sm:max-w-[425px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-esports-accent text-xl">
            Нова команда ({player.game.name})
          </DialogTitle>
          <DialogDescription className="text-esports-muted">
            Ви станете капітаном від імені профілю{' '}
            <span className="text-white font-bold">{player.nickname}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Назва команди</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Natus Vincere"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Тег команди</Label>
              <Input
                required
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="NAVI"
                maxLength={6}
                className="bg-slate-800 border-slate-700 text-white uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label>Регіон</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <Button
            disabled={loading}
            type="submit"
            className="w-full bg-esports-accent text-black hover:bg-esports-accent/90 font-bold mt-2"
          >
            {loading ? 'Реєстрація...' : 'Заснувати організацію'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
