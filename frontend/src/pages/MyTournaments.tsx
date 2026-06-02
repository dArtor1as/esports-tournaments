import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Trophy,
  Users,
  Globe,
  ChevronRight,
  Calendar,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function MyTournaments() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: tournamentsData, isLoading } = useQuery({
    queryKey: ['myTournaments', statusFilter],
    queryFn: async () => {
      const statusParam =
        statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const { data } = await api.get(`/tournaments/my?limit=50${statusParam}`);
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
        return 'Заплановано';
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад до профілю
      </Button>

      {/* ШАПКА ТА ФІЛЬТР */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Trophy className="text-esports-primary" size={32} />
            Організовані турніри
          </h1>
          <p className="text-slate-400 mt-1">
            Керуйте власними подіями та вирішуйте конфлікти.
          </p>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[200px] bg-slate-950 border-slate-800 text-white font-bold">
            <SelectValue placeholder="Фільтр за статусом" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white">
            <SelectItem value="all">Всі турніри</SelectItem>
            <SelectItem value="planned">Заплановані</SelectItem>
            <SelectItem value="live">Активні (LIVE)</SelectItem>
            <SelectItem value="finished">Завершені</SelectItem>
            <SelectItem value="cancelled">Скасовані</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* СПИСОК ТУРНІРІВ */}
      {isLoading ? (
        <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
          Завантаження турнірів...
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 italic">
          Турнірів з таким статусом не знайдено.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tournaments.map((tournament: any) => {
            const formattedDate = new Date(
              tournament.createdAt,
            ).toLocaleDateString('uk-UA', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            // ЛОГІКА СПОВІЩЕНЬ "ПОТРЕБУЄ УВАГИ"
            const hasDisputes =
              tournament.matches && tournament.matches.length > 0;
            const isReadyToStart =
              tournament.status === 'planned' &&
              tournament._count?.participants >= 4;

            return (
              <div
                key={tournament.id}
                onClick={() => navigate(`/tournament/${tournament.id}`)}
                className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-lg hover:border-esports-primary/50 transition-all cursor-pointer group overflow-hidden"
              >
                {/* БАНЕР СПОВІЩЕННЯ (Якщо є дії) */}
                {hasDisputes && (
                  <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2 flex items-center gap-2 text-red-400 text-xs font-black uppercase tracking-wider">
                    <AlertTriangle size={14} /> Конфлікт у матчі (Dispute)
                  </div>
                )}
                {!hasDisputes && isReadyToStart && (
                  <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                    <CheckCircle2 size={14} /> Готово до генерації сітки
                  </div>
                )}

                <div className="p-5 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <Badge
                        className={`border uppercase text-[10px] font-black tracking-wider px-2 py-0.5 ${getStatusColor(tournament.status)}`}
                      >
                        {getStatusLabel(tournament.status)}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <Globe size={12} /> {tournament.region}
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-white group-hover:text-esports-light transition-colors leading-tight mb-2">
                      {tournament.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Badge
                        variant="outline"
                        className="border-slate-700 text-esports-accent bg-esports-accent/5 uppercase text-[10px]"
                      >
                        {tournament.game?.name}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-700 text-slate-300 uppercase text-[10px]"
                      >
                        Tier {tournament.tier}
                      </Badge>
                      <div className="flex items-center gap-1 text-slate-500 text-xs uppercase font-bold ml-auto">
                        <Calendar size={12} className="text-slate-600" />{' '}
                        {formattedDate}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                      <Users size={16} />
                      <span className="font-bold text-white">
                        {tournament._count?.participants || 0}
                      </span>
                      <span className="text-xs">
                        / {tournament.maxParticipants} команд
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      className="p-0 h-auto text-esports-primary group-hover:translate-x-1 transition-transform"
                    >
                      Керувати <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
