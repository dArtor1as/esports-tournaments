import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { History, Target, Zap, Cpu, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SimulationRun {
  id: string;
  algorithmType: string;
  populations: number;
  generations: number;
  fitnessScore: number;
  executionTimeMs: number | null;
  isDryRun: boolean;
  createdAt: string;
}

interface TournamentGaHistoryTabProps {
  tournamentId: string;
}

export default function TournamentGaHistoryTab({
  tournamentId,
}: TournamentGaHistoryTabProps) {
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get(
          `/genetic-simulator/tournament/${tournamentId}/runs`,
        );
        setRuns(response.data);
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            'Не вдалося завантажити історію симуляцій',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [tournamentId]);

  const formatAlgorithmType = (type: string) => {
    switch (type) {
      case 'SINGLE_ELIMINATION':
        return 'Single Elim';
      case 'DOUBLE_ELIMINATION':
        return 'Double Elim';
      case 'GROUP_STAGE':
        return 'Group Stage';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex justify-center items-center h-64 text-esports-accent animate-pulse font-bold">
        <Cpu className="animate-spin mr-2" size={20} /> Завантаження логів...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-center text-red-400 font-bold">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6 animate-in fade-in duration-500">
      <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-4">
        <History size={18} className="text-esports-primary" /> Історія запусків
        ГА
      </h3>

      {runs.length === 0 ? (
        <p className="text-slate-500 italic text-center py-10">
          Алгоритм ще не запускався для цього турніру.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-950 text-slate-500 border-y border-slate-800">
              <tr>
                <th className="px-4 py-3 font-black tracking-wider">
                  Дата та Час
                </th>
                <th className="px-4 py-3 font-black tracking-wider">Режим</th>
                <th className="px-4 py-3 font-black tracking-wider">
                  Алгоритм
                </th>
                <th className="px-4 py-3 font-black tracking-wider text-center">
                  Pop / Gen
                </th>
                <th className="px-4 py-3 font-black tracking-wider text-center">
                  Фітнес Скор
                </th>
                <th className="px-4 py-3 font-black tracking-wider text-right">
                  Час виконання
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="hover:bg-slate-800/20 transition-colors"
                >
                  {/* Дата */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-white font-bold flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-slate-500" />
                        {new Date(run.createdAt).toLocaleDateString('uk-UA')}
                      </span>
                      <span className="text-xs text-slate-500 ml-5">
                        {new Date(run.createdAt).toLocaleTimeString('uk-UA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </td>

                  {/* Режим */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {run.isDryRun ? (
                      <Badge
                        variant="outline"
                        className="text-blue-400 border-blue-500/30 bg-blue-500/10 uppercase tracking-widest text-[10px]"
                      >
                        Прогноз
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 uppercase tracking-widest text-[10px]"
                      >
                        LIVE
                      </Badge>
                    )}
                  </td>

                  {/* Алгоритм */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 font-bold text-slate-300">
                      <Cpu size={14} className="text-esports-accent" />
                      {formatAlgorithmType(run.algorithmType)}
                    </span>
                  </td>

                  {/* Популяція / Покоління */}
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      <span className="text-white">{run.populations}</span> /{' '}
                      {run.generations}
                    </span>
                  </td>

                  {/* Фітнес */}
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="flex items-center justify-center gap-1.5 font-black text-yellow-400">
                      <Target size={14} className="text-yellow-500/70" />
                      {run.fitnessScore.toFixed(2)}
                    </span>
                  </td>

                  {/* Час виконання */}
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <span className="flex items-center justify-end gap-1.5 font-mono text-slate-400">
                      <Zap
                        size={14}
                        className={
                          run.executionTimeMs && run.executionTimeMs < 1000
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        }
                      />
                      {run.executionTimeMs
                        ? `${run.executionTimeMs} ms`
                        : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
