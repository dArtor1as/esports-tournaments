import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Trophy,
  Users,
  Globe,
  ChevronRight,
  Lock,
  Unlock,
  FilterX,
  Search,
  Calendar,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TournamentFormModal from '@/components/tournament/TournamentFormModal';
import { useState, useEffect } from 'react';

type TournamentStatus = 'planned' | 'live' | 'finished' | 'cancelled';
const REGIONS = ['EU', 'NA', 'CIS', 'ASIA', 'SA', 'GLOBAL'];

export default function Tournaments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Зчитуємо значення з URL, якщо їх немає — ставимо дефолтні
  const statusFilter =
    (searchParams.get('status') as TournamentStatus | 'all') || 'planned';
  const gameSlug = searchParams.get('gameSlug') || 'all';
  const tier = searchParams.get('tier') || 'all';
  const region = searchParams.get('region') || 'all';
  const isPublic = searchParams.get('isPublic') || 'all';
  const titleParam = searchParams.get('title') || '';

  // Єдина функція для оновлення параметрів в URL
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' && key !== 'status') {
      newParams.delete(key); // видаляємо параметр, якщо обрано "Всі", щоб URL був чистим
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  };

  const [searchValue, setSearchValue] = useState(titleParam);

  // Debounce: оновлюємо URL (і робимо запит) лише через 500мс після останнього натискання
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      updateFilter('title', searchValue);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  // Функція скидання додаткових фільтрів (зберігаючи поточну вкладку статусу)
  const resetFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set('status', statusFilter);
    setSearchParams(newParams);
    setSearchValue('');
  };

  // Отримання списку ігор для фільтру
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

  // Головний запит турнірів з усіма параметрами
  const { data: tournamentsData, isLoading } = useQuery({
    queryKey: [
      'tournaments',
      statusFilter,
      gameSlug,
      tier,
      region,
      isPublic,
      titleParam,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (gameSlug !== 'all') params.append('gameSlug', gameSlug);
      if (tier !== 'all') params.append('tier', tier);
      if (region !== 'all') params.append('region', region);
      if (isPublic !== 'all') params.append('isPublic', isPublic);
      if (titleParam) params.append('title', titleParam);

      const { data } = await api.get(`/tournaments?${params.toString()}`);
      return data;
    },
  });

  const tournaments = tournamentsData?.data || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'live':
        return 'text-red-500 bg-red-500/10 border-red-500/20 animate-pulse';
      case 'finished':
        return 'text-slate-400 bg-slate-800 border-slate-700';
      case 'cancelled':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planned':
        return 'Реєстрація / Заплановано';
      case 'live':
        return '🔴 LIVE';
      case 'finished':
        return 'Завершено';
      case 'cancelled':
        return 'Скасовано';
      default:
        return status;
    }
  };

  const hasActiveFilters =
    gameSlug !== 'all' ||
    tier !== 'all' ||
    region !== 'all' ||
    isPublic !== 'all';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-esports-primary/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white flex items-center gap-3 tracking-tight">
            <Trophy className="text-yellow-500" size={36} />
            Турнірний Хаб
          </h1>
          <p className="text-slate-400 mt-2 max-w-lg">
            Змагайтеся з кращими командами, здобувайте перемоги та піднімайте
            свій командний Elo у глобальному рейтингу.
          </p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row gap-3">
          {user?.role === 'ADMIN' && <TournamentFormModal mode="test" />}
          {user && <TournamentFormModal mode="standard" />}
        </div>
      </div>

      {/* ПАНЕЛЬ ФІЛЬТРІВ */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
        {/* Головні таби статусів */}
        <div className="flex gap-2 w-max">
          {['all', 'planned', 'live', 'finished'].map((status) => (
            <button
              key={status}
              onClick={() => updateFilter('status', status)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all ${
                statusFilter === status
                  ? 'bg-esports-accent text-black shadow-[0_0_10px_rgba(242,167,27,0.3)]'
                  : 'bg-slate-900 text-slate-500 hover:text-white border border-slate-800'
              }`}
            >
              {status === 'all'
                ? 'Всі турніри'
                : getStatusLabel(status).replace('🔴 ', '')}
            </button>
          ))}
        </div>

        {/* Додаткові фільтри */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60">
          {/* ПОЛЕ ПОШУКУ */}
          <div className="relative w-full md:w-[220px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={16}
            />
            <Input
              placeholder="Пошук за назвою..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-white h-9 placeholder:text-slate-500 focus-visible:ring-esports-primary/50"
            />
          </div>

          <Select
            value={gameSlug}
            onValueChange={(value) => updateFilter('gameSlug', value)}
          >
            <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700 text-slate-300 h-9">
              <SelectValue placeholder="Дисципліна" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-white">
              <SelectItem value="all">Всі ігри</SelectItem>
              {games.map((g: any) => (
                <SelectItem key={g.id} value={g.slug}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={tier}
            onValueChange={(value) => updateFilter('tier', value)}
          >
            <SelectTrigger className="w-[120px] bg-slate-900 border-slate-700 text-slate-300 h-9">
              <SelectValue placeholder="Тір" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-white">
              <SelectItem value="all">Всі Тіри</SelectItem>
              <SelectItem value="1">Tier 1 (Pro)</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3 (Amateur)</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={region}
            onValueChange={(value) => updateFilter('region', value)}
          >
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-slate-300 h-9">
              <SelectValue placeholder="Регіон" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-white">
              <SelectItem value="all">Всі Регіони</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={isPublic}
            onValueChange={(value) => updateFilter('isPublic', value)}
          >
            <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700 text-slate-300 h-9">
              <SelectValue placeholder="Тип доступу" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-white">
              <SelectItem value="all">Будь-який доступ</SelectItem>
              <SelectItem value="true">Відкриті (Public)</SelectItem>
              <SelectItem value="false">Закриті (Invite-only)</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="h-9 px-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-xs uppercase font-bold tracking-wider ml-auto"
            >
              <FilterX size={14} className="mr-1.5" /> Скинути
            </Button>
          )}
        </div>
      </div>

      {/* СПИСОК ТУРНІРІВ */}
      {isLoading ? (
        <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
          Завантаження розкладу...
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 italic">
          Турнірів з такими параметрами не знайдено.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tournaments.map((tournament: any) => {
            const isFull =
              tournament._count?.participants >= tournament.maxParticipants;
            const isOpen = tournament.isPublic;
            // Форматування дати створення турніру
            const formattedDate = new Date(
              tournament.createdAt,
            ).toLocaleDateString('uk-UA', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <div
                key={tournament.id}
                onClick={() => navigate(`/tournament/${tournament.id}`)}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg hover:shadow-xl hover:border-esports-primary/50 transition-all cursor-pointer group flex flex-col justify-between min-h-[200px]"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <Badge
                      className={`border uppercase text-[10px] font-black tracking-wider px-2 py-0.5 ${getStatusColor(tournament.status)}`}
                    >
                      {getStatusLabel(tournament.status)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <Globe size={12} /> {tournament.region}
                      </div>
                      {/* БЕЙДЖ ТИПУ ДОСТУПУ */}
                      <div
                        className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${isOpen ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'}`}
                      >
                        {isOpen ? <Unlock size={10} /> : <Lock size={10} />}
                        {isOpen ? 'Відкритий' : 'Закритий'}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-white group-hover:text-esports-light transition-colors leading-tight mb-2">
                    {tournament.title}
                  </h3>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-esports-accent bg-esports-accent/5 uppercase text-[10px]"
                    >
                      {tournament.game?.name || 'Game'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-slate-300 uppercase text-[10px]"
                    >
                      Tier {tournament.tier}
                    </Badge>
                    {/* БЛОК З ДАТОЮ */}
                    <div className="flex items-center gap-1 text-slate-500 text-[14px] uppercase font-bold ml-auto">
                      <Calendar size={12} className="text-slate-600" />
                      {formattedDate}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                      <Users
                        size={16}
                        className={isFull ? 'text-green-500' : 'text-slate-500'}
                      />
                      <span className="font-bold text-white">
                        {tournament._count?.participants || 0}
                      </span>
                      <span className="text-xs">
                        / {tournament.maxParticipants} команд
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    className="p-0 h-auto text-esports-primary group-hover:translate-x-1 transition-transform"
                  >
                    Деталі <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
