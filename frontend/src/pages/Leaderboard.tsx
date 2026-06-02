import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Trophy, Search, Globe, FilterX } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getFlagUrl } from '@/lib/helpers';

const REGIONS = ['EU', 'NA', 'CIS', 'ASIA', 'SA', 'GLOBAL'];

export default function Leaderboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Зчитуємо параметри з URL
  const gameSlug = searchParams.get('gameSlug') || 'cs2';
  const regionFilter = searchParams.get('region') || 'GLOBAL';
  const searchParam = searchParams.get('search') || '';

  // 2. Локальний стейт для поля пошуку (для Debounce)
  const [searchValue, setSearchValue] = useState(searchParam);

  // 3. Універсальна функція оновлення URL-параметрів
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'GLOBAL' || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  };

  // 4. Debounce ефект для текстового пошуку
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      updateFilter('search', searchValue);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  // 5. Функція скидання (залишає поточну гру, стирає решту)
  const resetFilters = () => {
    setSearchParams(new URLSearchParams({ gameSlug }));
    setSearchValue('');
  };

  const hasActiveFilters = regionFilter !== 'GLOBAL' || searchParam !== '';

  const { data: playersData, isLoading } = useQuery({
    queryKey: ['playersLeaderboard', regionFilter, gameSlug],
    queryFn: async () => {
      const regionQuery =
        regionFilter !== 'GLOBAL' ? `&region=${regionFilter}` : '';
      const gameQuery = `&gameSlug=${gameSlug}`;
      const { data } = await api.get(
        `/leaderboards/players?limit=100${regionQuery}${gameQuery}`,
      );
      return data.data || [];
    },
  });

  const playersList = playersData || [];

  // Фільтрація за ніком на фронтенді (оскільки API лідерборду гравців віддає топ-100)
  const filteredPlayers = playersList.filter((p: any) =>
    p.nickname.toLowerCase().includes(searchParam.toLowerCase()),
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ЄДИНИЙ БЛОК ДЛЯ ШАПКИ ТА ФІЛЬТРІВ (Темний фон) */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg flex flex-col gap-5">
        {/* Верхній ряд: Заголовок та Перемикач ігор */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              {/* ПОВЕРНУЛИ ЖОВТИЙ КУБОК */}
              <Trophy className="text-yellow-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">
                Зала слави
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Топ гравців за рейтингом Elo
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

        {/* Нижній ряд: Пошук, Регіон та Скинути */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full md:w-[260px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={16}
            />
            <Input
              placeholder="Пошук за нікнеймом..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 bg-slate-950 border-slate-800 text-white h-10"
            />
          </div>

          <Select
            value={regionFilter}
            onValueChange={(val) => updateFilter('region', val)}
          >
            <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800 text-white h-10">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-slate-400" />
                <SelectValue placeholder="Регіон" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r === 'GLOBAL' ? 'Всі регіони' : r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Кнопка скидання з'являється, коли є активні фільтри */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="text-slate-400 hover:text-white h-10"
            >
              <FilterX size={16} className="mr-2" /> Скинути
            </Button>
          )}
        </div>
      </div>

      {/* ТАБЛИЦЯ ГРАВЦІВ */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4 w-16 text-center">Місце</th>
                <th className="px-6 py-4">Гравець</th>
                <th className="px-6 py-4">Команда</th>
                <th className="px-6 py-4 text-right">Рейтинг ELO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    Завантаження рейтингу...
                  </td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    Гравців не знайдено.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player: any, index: number) => {
                  const rank = index + 1;
                  const isTop1 = rank === 1;

                  return (
                    <tr
                      key={player.id}
                      onClick={() => navigate(`/player/${player.id}`)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div
                          className={`text-center font-black text-xl ${
                            isTop1 ? 'text-yellow-400' : 'text-slate-500'
                          }`}
                        >
                          #{rank}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getFlagUrl(player.user?.countryCode) ? (
                            <img
                              src={getFlagUrl(player.user.countryCode)!}
                              alt="Flag"
                              className="w-5 h-3.5 rounded-sm object-cover shadow-sm"
                            />
                          ) : (
                            <Globe size={16} className="text-slate-600" />
                          )}
                          <div>
                            <div className="font-black text-white text-base group-hover:text-esports-accent transition-colors">
                              {player.nickname}
                            </div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                              {player.inGameRole || 'Player'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {player.team ? (
                          <div className="flex items-center gap-2 text-slate-300 group-hover:text-white transition-colors">
                            <span className="text-esports-accent font-mono text-[10px] font-black bg-slate-950 px-1.5 py-0.5 rounded">
                              [{player.team.tag}]
                            </span>
                            <span className="font-bold truncate max-w-[150px]">
                              {player.team.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 italic font-medium">
                            Вільний агент
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                          <Trophy
                            size={14}
                            className={
                              isTop1 ? 'text-yellow-400' : 'text-slate-500'
                            }
                          />
                          <span
                            className={`font-black text-lg ${
                              isTop1 ? 'text-yellow-400' : 'text-white'
                            }`}
                          >
                            {player.rating}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
