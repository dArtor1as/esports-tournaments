import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  Trophy,
  Users,
  Globe,
  ChevronRight,
  Search,
  FilterX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Teams() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Зчитуємо параметри з URL (дефолтна гра - cs2)
  const gameSlug = searchParams.get('gameSlug') || 'cs2';
  const tier = searchParams.get('tier') || 'all';
  const isComplete = searchParams.get('isComplete') || 'all';
  const searchParam = searchParams.get('search') || '';

  // 2. Локальний стейт для поля пошуку (для Debounce)
  const [searchValue, setSearchValue] = useState(searchParam);

  // 3. Універсальна функція оновлення URL-параметрів
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  };

  // 4. Debounce ефект: оновлює URL лише через 500мс після того, як користувач перестав вводити текст
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      updateFilter('search', searchValue);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  // 5. Функція скидання (залишає поточну гру, але стирає всі інші фільтри)
  const resetFilters = () => {
    setSearchParams(new URLSearchParams({ gameSlug }));
    setSearchValue('');
  };

  const hasActiveFilters =
    tier !== 'all' || isComplete !== 'all' || searchParam !== '';

  // 6. Оновлений запит до бекенду, який автоматично реагує на зміну URL
  const { data: teamsData, isLoading } = useQuery({
    queryKey: ['allTeams', gameSlug, tier, isComplete, searchParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '50'); // Ліміт для пагінації
      if (gameSlug && gameSlug !== 'all') params.append('gameSlug', gameSlug);
      if (tier !== 'all') params.append('tier', tier);
      if (isComplete !== 'all') params.append('isComplete', isComplete);
      if (searchParam) params.append('search', searchParam);

      const { data } = await api.get(
        `/leaderboards/teams?${params.toString()}`,
      );
      return data;
    },
  });

  const allTeams = teamsData?.data || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* БЛОК 1: ШАПКА, ПЕРЕМИКАЧ ДИСЦИПЛІН ТА СКИНУТИ */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-esports-primary/10 rounded-lg">
              <Trophy size={20} className="text-esports-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide uppercase">
                Глобальний рейтинг
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Топ команд за рейтингом Elo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Button
                variant={gameSlug === 'cs2' ? 'default' : 'outline'}
                onClick={() => updateFilter('gameSlug', 'cs2')}
                className={
                  gameSlug === 'cs2'
                    ? 'bg-esports-accent text-black font-black'
                    : 'border-slate-700 text-slate-400'
                }
              >
                Counter-Strike 2
              </Button>
              <Button
                variant={gameSlug === 'dota2' ? 'default' : 'outline'}
                onClick={() => updateFilter('gameSlug', 'dota2')}
                className={
                  gameSlug === 'dota2'
                    ? 'bg-esports-accent text-black font-black'
                    : 'border-slate-700 text-slate-400'
                }
              >
                Dota 2
              </Button>
            </div>
          </div>
        </div>

        {/* БЛОК 2: НОВІ ФІЛЬТРИ ТА ПОШУК */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Поле пошуку */}
          <div className="relative w-full md:w-[260px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={16}
            />
            <Input
              placeholder="Пошук за назвою чи тегом..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 bg-slate-950 border-slate-800 text-white h-10"
            />
          </div>

          {/* Фільтр за Tier */}
          <Select
            value={tier}
            onValueChange={(val) => updateFilter('tier', val)}
          >
            <SelectTrigger className="w-[140px] bg-slate-950 border-slate-800 text-white h-10">
              <SelectValue placeholder="Всі Tier" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="all">Всі Tier</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
            </SelectContent>
          </Select>

          {/* Фільтр за укомплектованістю */}
          <Select
            value={isComplete}
            onValueChange={(val) => updateFilter('isComplete', val)}
          >
            <SelectTrigger className="w-[190px] bg-slate-950 border-slate-800 text-white h-10">
              <SelectValue placeholder="Статус ростера" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="all">Всі команди</SelectItem>
              <SelectItem value="true">Укомплектовані (5/5)</SelectItem>
              <SelectItem value="false">Шукають гравців</SelectItem>
            </SelectContent>
          </Select>

          {/* Кнопка скидання з'являється лише якщо є активні фільтри */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="text-slate-400 hover:text-white "
            >
              <FilterX size={16} className="mr-2" /> Скинути
            </Button>
          )}
        </div>
      </div>

      {/* БЛОК 3: СПИСОК КОМАНД */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-10 text-slate-500">
            Завантаження команд...
          </div>
        ) : allTeams.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            Команд за вашими критеріями не знайдено.
          </div>
        ) : (
          allTeams.map((team: any, index: number) => {
            const rank = index + 1; // Рахуємо місце команди

            return (
              <div
                key={team.id}
                onClick={() => navigate(`/team/${team.id}`)}
                className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between group hover:border-esports-primary hover:shadow-[0_0_15px_rgba(242,167,27,0.15)] transition-all cursor-pointer"
              >
                {/* ЛІВА ЧАСТИНА */}
                <div className="flex items-center gap-4">
                  {/* Ранг */}
                  <div
                    className={`w-10 text-center font-black text-xl ${
                      rank === 1 ? 'text-yellow-400' : 'text-slate-500'
                    }`}
                  >
                    #{rank}
                  </div>

                  {/* Логотип */}
                  <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                    {team.logoUrl ? (
                      <img
                        src={team.logoUrl}
                        alt={team.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-500 font-bold uppercase text-lg">
                        {team.tag?.substring(0, 2) || 'T'}
                      </span>
                    )}
                  </div>

                  {/* Назва та Тег */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-esports-accent font-mono text-xs font-black uppercase tracking-widest">
                        [{team.tag}]
                      </span>
                      <h3 className="text-lg font-black text-white">
                        {team.name}
                      </h3>
                    </div>
                    {/* Регіон */}
                    <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 uppercase tracking-wider font-bold">
                      <Globe size={12} className="text-slate-500" />
                      Регіон: {team.region}
                    </span>
                  </div>
                </div>

                {/* ПРАВА ЧАСТИНА */}
                <div className="flex items-center gap-6">
                  {/* Статус повноти */}
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                      Ростер
                    </span>
                    <span
                      className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${
                        team.isComplete ? 'text-green-500' : 'text-yellow-500'
                      }`}
                    >
                      <Users size={12} />
                      {team.isComplete ? 'Повний' : 'Шукають +'}
                    </span>
                  </div>

                  {/* Командний Elo плашка */}
                  <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 px-4 py-2 rounded-xl min-w-[105px] justify-center shadow-inner">
                    <Trophy
                      size={15}
                      className={
                        rank === 1 ? 'text-yellow-400' : 'text-slate-500'
                      }
                    />
                    <span
                      className={`font-black text-base tracking-tight ${
                        rank === 1 ? 'text-yellow-400' : 'text-white'
                      }`}
                    >
                      {team.averageRating}
                    </span>
                  </div>

                  {/* Стрілочка переходу */}
                  <ChevronRight
                    size={18}
                    className="text-slate-600 group-hover:text-esports-accent group-hover:translate-x-0.5 transition-all flex-shrink-0"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
