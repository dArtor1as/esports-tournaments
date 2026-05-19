import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Trophy, Bot, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const REGIONS = ['EU', 'NA', 'CIS', 'ASIA', 'SA', 'GLOBAL'];

interface TournamentFormModalProps {
  mode: 'standard' | 'test';
}

export default function TournamentFormModal({
  mode,
}: TournamentFormModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Спільний стан форми
  const [title, setTitle] = useState('');
  const [gameId, setGameId] = useState('');
  const [teamCount, setTeamCount] = useState('16');
  const [bracketType, setBracketType] = useState('SINGLE_ELIMINATION');
  const [groupCount, setGroupCount] = useState('2');
  const [tier, setTier] = useState('3');
  const [region, setRegion] = useState('GLOBAL');
  const [isPublic, setIsPublic] = useState('true');

  // Завантаження ігор
  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/games');
        return Array.isArray(data) ? data : data.data || [];
      } catch {
        return [];
      }
    },
  });

  const isTest = mode === 'test';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameId) return toast.error('Оберіть ігрову дисципліну');

    setLoading(true);
    try {
      const endpoint = isTest ? '/tournaments/generate-test' : '/tournaments';
      // Формуємо payload залежно від режиму
      const payload = isTest
        ? {
            title: title.trim() || undefined,
            gameId,
            teamCount: parseInt(teamCount),
            bracketType,
            tier: parseInt(tier),
            region,
            isPublic: isPublic === 'true',
            ...(bracketType === 'ROUND_ROBIN' && {
              groupCount: parseInt(groupCount),
            }),
          }
        : {
            title,
            gameId,
            tier: parseInt(tier),
            region,
            kFactor: 1.0,
            maxParticipants: parseInt(teamCount),
            format: 'TEAM',
            isPublic: isPublic === 'true',
            settings: {
              bracketType,
              ...(bracketType === 'ROUND_ROBIN' && {
                groupCount: parseInt(groupCount),
              }),
            },
          };

      await api.post(endpoint, payload);

      toast.success(
        isTest
          ? 'Тестовий турнір успішно згенеровано з командами!'
          : 'Турнір успішно створено!',
      );
      setIsOpen(false);
      await queryClient.refetchQueries({ queryKey: ['tournaments'] });
      setTitle('');
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Помилка при створенні турніру',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isTest ? (
          <Button
            variant="outline"
            className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 font-bold"
          >
            <Bot size={18} className="mr-2" /> Auto-Fill Турнір
          </Button>
        ) : (
          <Button className="bg-esports-primary hover:bg-esports-primary/90 text-white font-bold">
            <Trophy size={18} className="mr-2" /> Організувати турнір
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle
            className={`text-xl flex items-center gap-2 ${isTest ? 'text-purple-400' : 'text-esports-accent'}`}
          >
            {isTest ? <Sparkles size={20} /> : <Trophy size={20} />}
            {isTest ? 'Швидка генерація (Test)' : 'Новий турнір'}
          </DialogTitle>
          <DialogDescription className="text-esports-muted">
            {isTest
              ? 'Створіть турнір, який миттєво заповниться випадковими командами для тестів.'
              : 'Налаштуйте параметри змагання та відкрийте реєстрацію для команд.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Назва турніру {isTest && '(Опціонально)'}</Label>
            <Input
              required={!isTest}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isTest ? 'Auto-Cup 2026' : 'Autumn Major 2026'}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Дисципліна</Label>
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Оберіть гру" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {games.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Формат сітки</Label>
              <Select value={bracketType} onValueChange={setBracketType}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="SINGLE_ELIMINATION">
                    Single Elimination
                  </SelectItem>
                  <SelectItem value="DOUBLE_ELIMINATION">
                    Double Elimination
                  </SelectItem>
                  <SelectItem value="ROUND_ROBIN">
                    Round Robin (Групи)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Кількість команд</Label>
              <Select value={teamCount} onValueChange={setTeamCount}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {[4, 8, 16, 32].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} команд
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ДИНАМІЧНЕ ПОЛЕ: Кількість груп */}
            {bracketType === 'ROUND_ROBIN' && (
              <div className="space-y-2 col-span-2 p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg animate-in fade-in zoom-in-95">
                <Label className="text-esports-accent">Кількість груп</Label>
                <Select value={groupCount} onValueChange={setGroupCount}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="1">1 група</SelectItem>
                    <SelectItem value="2">2 групи</SelectItem>
                    <SelectItem value="4">4 групи</SelectItem>
                    <SelectItem value="8">8 груп</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Увага: кількість команд ({teamCount}) має ділитися на
                  кількість груп порівну.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Тип доступу</Label>
              <Select value={isPublic} onValueChange={setIsPublic}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="true">Відкритий (Вільний)</SelectItem>
                  <SelectItem value="false">Закритий (Інвайти)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Тір та Регіон</Label>
              <div className="flex gap-2">
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-1/3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="1">Tier 1</SelectItem>
                    <SelectItem value="2">Tier 2</SelectItem>
                    <SelectItem value="3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-2/3">
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
          </div>

          <div className="pt-2">
            <Button
              disabled={loading || !gameId}
              type="submit"
              className={`w-full font-bold text-white ${isTest ? 'bg-purple-600 hover:bg-purple-500' : 'bg-esports-accent text-black hover:bg-esports-accent/90'}`}
            >
              {loading
                ? 'Обробка...'
                : isTest
                  ? 'Згенерувати тестовий турнір'
                  : 'Анонсувати турнір'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
