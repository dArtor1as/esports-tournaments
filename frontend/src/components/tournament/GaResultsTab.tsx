import { Info, GitBranch, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import TournamentBracket from "@/components/TournamentBracket";

interface GaResultsTabProps {
  predictionResult: any;
  enrichedBracket: any[];
  bracketType: string;
  onGoToBracket: () => void;
}

export default function GaResultsTab({
  predictionResult,
  enrichedBracket,
  bracketType,
  onGoToBracket,
}: GaResultsTabProps) {
  const isLive = predictionResult.isLive;

  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-500">
      {/* Динамічний банер */}
      {isLive ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle
            className="text-emerald-400 mt-0.5 flex-shrink-0"
            size={18}
          />
          <div>
            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
              Етап завершено офіційно
            </h4>
            <p className="text-xs text-slate-400">
              Результати записані в БД. Гравці отримали оновлений рейтинг Elo.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
          <Info className="text-blue-400 mt-0.5 flex-shrink-0" size={18} />
          <div>
            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
              Дані тимчасові
            </h4>
            <p className="text-xs text-slate-400">
              Цей прогноз зберігається локально. Він зникне, якщо ви закриєте цю
              вкладку.
            </p>
          </div>
        </div>
      )}

      {/* ФІТНЕС СКОР */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/10 via-slate-900/10 to-transparent"></div>
        <div className="relative z-10">
          <h4
            className={`${isLive ? "text-emerald-400" : "text-blue-400"} font-black tracking-widest text-sm uppercase mb-2`}
          >
            {isLive ? "Симуляцію Завершено" : "ШІ Прогноз Завершено"}
          </h4>
          <div className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">
            Оцінка фітнесу
          </div>
          <div className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">
            {predictionResult.bestFitnessScore?.toFixed(2)}
          </div>
          <p className="mt-4 text-xs text-slate-300 max-w-md mx-auto">
            {predictionResult.statsMessage}
          </p>
        </div>
      </div>

      {/* СІТКА АБО КНОПКА */}
      {isLive ? (
        <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-xl">
          <Button
            onClick={onGoToBracket}
            className="bg-esports-primary hover:bg-esports-primary/90 text-white font-bold"
          >
            <GitBranch size={16} className="mr-2" /> Переглянути офіційну сітку
          </Button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
            <GitBranch size={18} className="text-blue-400" />{" "}
            <Sparkles size={16} className="text-blue-400" /> Гіпотетична сітка
            від AI
          </h3>
          <TournamentBracket
            matches={enrichedBracket}
            bracketType={bracketType}
          />
        </div>
      )}
    </div>
  );
}
