import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Swords } from 'lucide-react';

// Ролі, які ми беремо з твого player.enums.ts
const ROLES = {
  cs2: ['SNIPER', 'RIFLER', 'ENTRY', 'SUPPORT', 'IGL'],
  dota2: ['POS_1', 'POS_2', 'POS_3', 'POS_4', 'POS_5'],
};

interface CreatePlayerModalProps {
  onSuccess: () => void; // Функція для оновлення списку після створення
}

export default function CreatePlayerModal({
  onSuccess,
}: CreatePlayerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Стан форми
  const [gameSlug, setGameSlug] = useState<'cs2' | 'dota2'>('cs2');
  const [nickname, setNickname] = useState('');
  const [inGameRole, setInGameRole] = useState('');
  const [expectedTier, setExpectedTier] = useState('3'); // 3 - найнижчий рівень

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/players', {
        gameSlug,
        nickname,
        inGameRole,
        expectedTier: parseInt(expectedTier),
      });

      setIsOpen(false); // Закриваємо модалку
      onSuccess(); // Оновлюємо дані на сторінці профілю
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка при створенні профілю');
    } finally {
      setLoading(false);
    }
  };

  // Коли змінюється гра, скидаємо роль, бо вони різні для CS2 і Dota
  const handleGameChange = (val: 'cs2' | 'dota2') => {
    setGameSlug(val);
    setInGameRole('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-esports-primary hover:bg-esports-primary/90 text-white shadow-md">
          <Swords size={18} className="mr-2" /> Створити ігровий профіль
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-esports-accent text-xl">
            Новий ігровий профіль
          </DialogTitle>
          <DialogDescription className="text-esports-muted">
            Оберіть дисципліну та ваш ігровий нікнейм.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Дисципліна</Label>
            <Select value={gameSlug} onValueChange={handleGameChange}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Оберіть гру" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="cs2">Counter-Strike 2</SelectItem>
                <SelectItem value="dota2">Dota 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ігровий нікнейм</Label>
            <Input
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Наприклад: s1mple"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label>Ігрова роль</Label>
            {/* Додаємо унікальний key, щоб Select повністю скидався при зміні дисципліни */}
            <Select
              key={gameSlug}
              value={inGameRole}
              onValueChange={setInGameRole}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Оберіть роль" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                {ROLES[gameSlug].map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Очікуваний рівень (для калібрування Elo)</Label>
            <Select value={expectedTier} onValueChange={setExpectedTier}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Оберіть рівень" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="1">Tier 1 (Pro / Faceit 10)</SelectItem>
                <SelectItem value="2">Tier 2 (Advanced)</SelectItem>
                <SelectItem value="3">Tier 3 (Amateur / Casual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <div className="pt-4 flex justify-end">
            <Button
              disabled={loading}
              type="submit"
              className="bg-esports-accent text-black hover:bg-esports-accent/90 w-full font-bold"
            >
              {loading ? 'Створення...' : 'Зареєструвати профіль'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
