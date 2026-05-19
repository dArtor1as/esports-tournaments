import { Calendar, GitBranch, LayoutGrid, Network } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import TournamentBracket from '@/components/TournamentBracket';
import GroupStageStandings from '@/components/tournament/GroupStageStandings';
import ConfirmModal from '@/components/ConfirmModal';

interface TournamentBracketTabProps {
  matches: any[];
  tournament: any;
  participantsCount: number;
  bracketLoading: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  onGenerateBracket: () => void;
  isGroupStageComplete?: boolean;
  hasPlayoffMatches?: boolean;
  onTransitionToPlayoffs?: () => void;
  onFinishTournament?: () => void;
}

export default function TournamentBracketTab({
  matches,
  tournament,
  participantsCount,
  bracketLoading,
  isCreator,
  isAdmin,
  onGenerateBracket,
  isGroupStageComplete,
  hasPlayoffMatches,
  onTransitionToPlayoffs,
  onFinishTournament,
}: TournamentBracketTabProps) {
  const isRoundRobin = tournament.settings?.bracketType === 'ROUND_ROBIN';
  // Локальний стейт для перемикання етапів відображення всередині вкладки
  const [subStageView, setSubStageView] = useState<'group' | 'playoff'>(
    hasPlayoffMatches ? 'playoff' : 'group',
  );

  useEffect(() => {
    if (hasPlayoffMatches) {
      setSubStageView('playoff');
    }
  }, [hasPlayoffMatches]);

  const sortedMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => {
      if (a.stage !== b.stage) return a.stage.localeCompare(b.stage);
      if (a.bracket !== b.bracket)
        return (a.bracket || '').localeCompare(b.bracket || '');
      if (a.round !== b.round) return a.round - b.round;
      return a.id.localeCompare(b.id);
    });
  }, [matches]);

  // Фільтруємо суто за стадією PLAYOFF ігноруємо поле bracket
  const playoffOnlyMatches = useMemo(() => {
    return sortedMatches.filter((m) => m.stage === 'PLAYOFF');
  }, [sortedMatches]);

  const groupOnlyMatches = useMemo(() => {
    return sortedMatches.filter((m) => m.stage === 'GROUP');
  }, [sortedMatches]);

  const effectivePlayoffBracketType = useMemo(() => {
    const hasLowerBracket = playoffOnlyMatches.some(
      (m) => m.bracket === 'LOWER',
    );
    return hasLowerBracket ? 'DOUBLE_ELIMINATION' : 'SINGLE_ELIMINATION';
  }, [playoffOnlyMatches]);

  const isTournamentFinished = tournament?.status === 'finished';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl overflow-hidden min-h-[400px] space-y-6">
      {/* МЕНЮ КЕРУВАННЯ ЕТАПАМИ ТА ДІЯМИ ОРГАНІЗАТОРА */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Calendar size={18} className="text-esports-primary" /> Офіційна
            стадія
          </h3>

          {/* Якщо є обидва етапи — показуємо внутрішній перемикач */}
          {isRoundRobin && hasPlayoffMatches && (
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setSubStageView('group')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${subStageView === 'group' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <LayoutGrid size={14} /> Групи
              </button>
              <button
                onClick={() => setSubStageView('playoff')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${subStageView === 'playoff' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Network size={14} /> Плей-оф сітка
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Генерація (якщо ще немає матчів) */}
          {(isCreator || isAdmin) &&
            !isTournamentFinished &&
            matches.length === 0 && (
              <Button
                onClick={onGenerateBracket}
                disabled={bracketLoading || participantsCount < 2}
                className="bg-esports-accent text-black hover:bg-esports-accent/90 text-xs font-black uppercase h-8"
              >
                <GitBranch size={14} className="mr-1.5" />{' '}
                {bracketLoading ? 'Формування...' : 'Згенерувати сітку'}
              </Button>
            )}

          {/* Кнопки переходу після груп (ховаються, якщо турнір завершено) */}
          {(isCreator || isAdmin) &&
            !isTournamentFinished &&
            isGroupStageComplete &&
            !hasPlayoffMatches && (
              <>
                <Button
                  onClick={onTransitionToPlayoffs}
                  disabled={bracketLoading}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase h-8 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                >
                  <GitBranch size={14} className="mr-1.5" />{' '}
                  {bracketLoading ? 'Обробка...' : 'Перейти до Плей-оф'}
                </Button>

                <ConfirmModal
                  title="Завершити турнір без Плей-оф?"
                  description="Ця дія назавжди закриє турнір та перерахує рейтинги Elo для команд на основі групового етапу."
                  onConfirm={onFinishTournament!}
                  confirmText="Завершити турнір"
                >
                  <Button
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs font-black uppercase h-8"
                  >
                    Завершити турнір (без Плей-оф)
                  </Button>
                </ConfirmModal>
              </>
            )}
        </div>
      </div>

      {/* РЕНДЕР СТАДІЙ */}
      <div className="pt-2">
        {tournament.settings?.bracketType === 'ROUND_ROBIN' &&
        subStageView === 'group' ? (
          <GroupStageStandings matches={groupOnlyMatches} pointsPerWin={3} />
        ) : (
          <TournamentBracket
            matches={isRoundRobin ? playoffOnlyMatches : sortedMatches}
            /* Передаємо вирахований тип сітки (SINGLE або DOUBLE), ігноруючи ROUND_ROBIN з бази */
            bracketType={
              isRoundRobin
                ? effectivePlayoffBracketType
                : tournament.settings?.bracketType || 'SINGLE_ELIMINATION'
            }
          />
        )}
      </div>
    </div>
  );
}
