import {
  GitBranch,
  Play,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Activity,
  Users,
  Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WorkflowTableProps {
  data: any[];
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalFilteredCount: number;
  updateFilter: (key: string, value: string) => void;
}

export default function WorkflowTable({
  data,
  currentPage,
  totalPages,
  itemsPerPage,
  totalFilteredCount,
  updateFilter,
}: WorkflowTableProps) {
  const navigate = useNavigate();

  // Логіка визначення статусу дій
  const renderWorkflowAction = (tournament: any) => {
    if (tournament.requiresTransitionToPlayoffs) {
      return (
        <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20 w-fit">
          <GitBranch size={14} /> Пора генерувати Плей-оф
        </div>
      );
    }
    if (tournament.canGenerateBracket) {
      return (
        <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider bg-amber-500/10 px-3 py-1.5 rounded-md border border-amber-500/20 w-fit">
          <Play size={14} /> Очікує генерації сітки
        </div>
      );
    }
    if (tournament.status === 'planned' && !tournament.canGenerateBracket) {
      return (
        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs tracking-wider">
          <Users size={14} /> Збір ({tournament.participantsCount}/
          {tournament.maxParticipants})
        </div>
      );
    }
    if (tournament.status === 'live') {
      return (
        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs tracking-wider">
          <Activity size={14} /> LIVE
        </div>
      );
    }
    if (tournament.status === 'finished') {
      return (
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs tracking-wider">
          <CheckCircle2 size={14} /> Завершено
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-slate-500 font-bold text-xs tracking-wider">
        <AlertCircle size={14} /> Немає активних дій
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-widest font-black">
              <th className="px-6 py-4">Назва турніру</th>
              <th className="px-6 py-4 text-center">Команди</th>
              <th className="px-6 py-4 text-center">Статистика Матчів</th>
              <th className="px-6 py-4">Статус дій (Workflow)</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  Турнірів за вашими фільтрами не знайдено.
                </td>
              </tr>
            ) : (
              data.map((t: any) => (
                <tr
                  key={t.id}
                  className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/tournament/${t.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="font-black text-white text-sm truncate max-w-[250px] group-hover:text-purple-400 transition-colors">
                      {t.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        variant="outline"
                        className="text-[9px] border-slate-700 text-slate-400 bg-slate-950"
                      >
                        {t.gameName}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] border-slate-700 text-slate-400 bg-slate-950"
                      >
                        {t.format}
                      </Badge>
                      {/* ДАТА СТВОРЕННЯ */}
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold ml-1">
                        <Calendar size={12} />
                        {new Date(t.createdAt).toLocaleDateString('uk-UA', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center font-black text-slate-300">
                    {t.participantsCount}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center text-xs">
                      {t.status === 'cancelled' ? (
                        <span className="text-slate-500 font-bold">
                          Зіграно: {t.playedMatches || 0}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-bold">
                          Зіграно: {t.playedMatches || 0} / {t.totalMatches}
                        </span>
                      )}
                      {t.hasGeneratedGrid && (
                        <span className="text-slate-500 mt-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Групи: {t.groupMatches} | Плей-оф: {t.playoffMatches}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">{renderWorkflowAction(t)}</td>

                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      className="p-2 h-auto text-purple-500 group-hover:bg-purple-500/10"
                    >
                      <ChevronRight size={20} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER ТАБЛИЦІ (Пагінація) */}
      {totalPages > 1 && (
        <div className="border-t border-slate-800 p-4 flex items-center justify-between bg-slate-950/50 rounded-b-xl">
          <div className="text-xs text-slate-500 font-medium">
            Показано {(currentPage - 1) * itemsPerPage + 1} -{' '}
            {Math.min(currentPage * itemsPerPage, totalFilteredCount)} з{' '}
            {totalFilteredCount} турнірів
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateFilter('page', String(Math.max(1, currentPage - 1)))
              }
              disabled={currentPage === 1}
              className="border-slate-700 text-white hover:bg-slate-800"
            >
              Попередня
            </Button>
            <div className="text-sm font-bold text-slate-300 px-4">
              {currentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateFilter(
                  'page',
                  String(Math.min(totalPages, currentPage + 1)),
                )
              }
              disabled={currentPage === totalPages}
              className="border-slate-700 text-white hover:bg-slate-800"
            >
              Наступна
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
