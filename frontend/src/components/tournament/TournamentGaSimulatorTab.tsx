import { Cpu, Eye, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TournamentGaSimulatorTabProps {
  populations: string;
  setPopulations: (val: string) => void;
  simLoading: boolean;
  matchesLength: number;
  tournamentStatus: string;
  isCreator: boolean;
  isAdmin: boolean;
  onRunAlgorithm: (isDryRun: boolean) => void;
}

export default function TournamentGaSimulatorTab({
  populations,
  setPopulations,
  simLoading,
  matchesLength,
  tournamentStatus,
  isCreator,
  isAdmin,
  onRunAlgorithm,
}: TournamentGaSimulatorTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 h-max">
          <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu size={18} className="text-esports-accent" /> Налаштування
          </h3>
          <div className="space-y-2">
            <Label>Розмір популяції (Populations)</Label>
            <Input
              type="number"
              value={populations}
              onChange={(e) => setPopulations(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white font-mono"
              min={10}
              max={1000}
            />
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-xl font-black text-white mb-1">
              Аналітичне моделювання
            </h3>
            <p className="text-sm text-slate-400">
              Режими взаємодії з генетичним інтелектом.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Forecast */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative group overflow-hidden">
              <div className="space-y-2">
                <div className="text-blue-400 font-black tracking-widest text-[10px] uppercase flex items-center gap-1">
                  <Eye size={12} /> Безпечний режим
                </div>
                <h4 className="text-lg font-bold text-white">
                  ШІ-Прогнозування розвитку
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Алгоритм симулює тисячі комбінацій матчів у пам'яті без впливу
                  на базу даних.
                </p>
              </div>
              <Button
                disabled={simLoading || matchesLength === 0}
                onClick={() => onRunAlgorithm(true)}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider"
              >
                {simLoading ? 'Процесинг ШІ...' : 'Запустити AI Forecast'}
              </Button>
            </div>

            {/* LIVE SIMULATION */}
            {(isCreator || isAdmin) && tournamentStatus !== 'finished' && (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <div className="space-y-2">
                  <div className="text-red-500 font-black tracking-widest text-[10px] uppercase flex items-center gap-1">
                    <Play size={12} /> Live-генерація
                  </div>
                  <h4 className="text-lg font-bold text-white">
                    Автоматичний розрахунок
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Симуляція запише результати матчів у БД та нарахує реальне
                    Elo гравцям.
                  </p>
                </div>
                <Button
                  disabled={simLoading || matchesLength === 0}
                  onClick={() => onRunAlgorithm(false)}
                  className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider"
                >
                  {simLoading
                    ? 'Генерація турніру...'
                    : 'Симулювати етап в LIVE'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
