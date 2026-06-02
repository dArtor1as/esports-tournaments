import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTournamentDetailsData } from '@/hooks/useTournamentData';
import { api } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Cpu, Sparkles, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import TournamentHeader from '@/components/tournament/TournamentHeader';
import TournamentBracketTab from '@/components/tournament/TournamentBracketTab';
import TournamentParticipantsTab from '@/components/tournament/TournamentParticipantsTab';
import TournamentGaSimulatorTab from '@/components/tournament/TournamentGaSimulatorTab';
import GaResultsTab from '@/components/tournament/GaResultsTab';
import { useMyProfilesData } from '@/hooks/useProfileData';
import { useQueryClient } from '@tanstack/react-query';

export default function TournamentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const {
    tournament,
    participants,
    matches,
    refetchMatches,
    refetchTournament,
    isLoading,
  } = useTournamentDetailsData(id);

  const [activeTab, setActiveTab] = useState('bracket');
  const [populations, setPopulations] = useState('100');
  const [simLoading, setSimLoading] = useState(false);
  const [bracketLoading, setBracketLoading] = useState(false);

  // Зберігаємо результати в localStorage (Forecast і Live-Fitness)
  const [predictionResult, setPredictionResult] = useState<any>(() => {
    const saved = localStorage.getItem(`forecast_${id}`);
    return saved ? JSON.parse(saved) : null;
  });

  const { data: myProfiles = [] } = useMyProfilesData(!!currentUser);

  useEffect(() => {
    if (predictionResult) {
      localStorage.setItem(`forecast_${id}`, JSON.stringify(predictionResult));
    } else {
      localStorage.removeItem(`forecast_${id}`);
    }
  }, [predictionResult, id]);

  if (isLoading)
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження турніру...
      </div>
    );
  if (!tournament)
    return (
      <div className="text-center py-20 text-red-500 font-bold">
        Турнір не знайдено.
      </div>
    );

  const isCreator = tournament.creatorId === currentUser?.id;
  const isAdmin = currentUser?.role === 'ADMIN';
  const isTournamentOver =
    tournament.status === 'finished' || tournament.status === 'cancelled';

  const handleGenerateBracket = async () => {
    setBracketLoading(true);
    try {
      const isGroupStage = tournament.settings?.bracketType === 'ROUND_ROBIN';
      const endpoint = isGroupStage
        ? '/matches/generate-groups'
        : '/matches/generate-bracket';

      // Читаємо кількість груп з налаштувань, або ставимо фолбек (2 групи)
      const groupCount = tournament.settings?.groupCount || 2;

      await api.post(endpoint, {
        tournamentId: id,
        teamCount: participants.length,
        // Передаємо кількість груп лише для групового етапу
        ...(isGroupStage && { groupCount }),
      });

      await refetchMatches();
      await refetchTournament();
      await queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Турнірну сітку успішно сформовано!');
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Не вдалося згенерувати сітку.',
      );
    } finally {
      setBracketLoading(false);
    }
  };

  const runGeneticAlgorithm = async (isDryRun: boolean) => {
    setSimLoading(true);
    try {
      const isGroupStage =
        tournament.settings?.bracketType === 'ROUND_ROBIN' &&
        !hasPlayoffMatches;
      const endpoint = isGroupStage
        ? '/genetic-simulator/run-groups'
        : '/genetic-simulator/run';

      const response = await api.post(endpoint, {
        tournamentId: id,
        populations: parseInt(populations),
        isDryRun,
        stage: isGroupStage ? 'GROUP' : 'PLAYOFF',
      });

      // Зберігаємо результат для обох режимів
      setPredictionResult({ ...response.data, isLive: !isDryRun });

      if (isDryRun) {
        toast.success('ШІ-Аналітичний прогноз успішно розраховано!');
      } else {
        toast.success('Матчі етапу успішно симульовано в LIVE!');
        await refetchMatches();
        await refetchTournament();
        await queryClient.invalidateQueries({ queryKey: ['tournament'] });
        await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      }

      setActiveTab('ga-forecast-results'); // Завжди перекидаємо на вкладку результатів, щоб показати Фітнес
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка роботи алгоритму');
    } finally {
      setSimLoading(false);
    }
  };

  const closePrediction = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPredictionResult(null);
    setActiveTab('ga-simulator');
  };

  const enrichedPredictionBracket = predictionResult
    ? matches.map((originalMatch: any) => {
        const predictedMatch = predictionResult.bracket?.find(
          (pm: any) => pm.id === originalMatch.id,
        );
        if (!predictedMatch) return originalMatch;

        const pA = participants.find(
          (p: any) => p.teamId === predictedMatch.teamAId,
        );
        const pB = participants.find(
          (p: any) => p.teamId === predictedMatch.teamBId,
        );

        return {
          ...originalMatch,
          teamAId: predictedMatch.teamAId,
          teamBId: predictedMatch.teamBId,
          scoreA: predictedMatch.scoreA,
          scoreB: predictedMatch.scoreB,
          matchStatus: 'COMPLETED',
          teamA: pA?.team || { tag: 'TBD', name: 'To Be Determined' },
          teamB: pB?.team || { tag: 'TBD', name: 'To Be Determined' },
        };
      })
    : [];

  // Перевірка стадій турніру
  const groupMatches = matches.filter((m: any) => m.stage === 'GROUP');
  const playoffMatches = matches.filter((m: any) => m.stage === 'PLAYOFF');

  const isGroupStageComplete =
    tournament?.settings?.bracketType === 'ROUND_ROBIN' &&
    groupMatches.length > 0 &&
    groupMatches.every((m: any) => m.isProcessed);

  const hasPlayoffMatches = playoffMatches.length > 0;

  // Виправляємо генерацію плей-оф
  const handleTransitionToPlayoffs = async () => {
    setBracketLoading(true);
    try {
      const response = await api.post('/matches/transition-to-playoffs', {
        tournamentId: id,
      });

      // Розраховуємо кількість команд динамічно!
      const playoffTeams = response.data.playoffTeams || [];
      const teamCount = playoffTeams.length;

      await api.post('/matches/generate-bracket', {
        tournamentId: id,
        bracketType: 'SINGLE_ELIMINATION',
        teamCount: teamCount,
      });

      await refetchMatches();
      await refetchTournament();
      await queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      toast.success('Сітку Плей-оф успішно сформовано з лідерів груп!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка переходу до Плей-оф');
    } finally {
      setBracketLoading(false);
    }
  };

  const handleFinishTournament = async () => {
    try {
      await api.post(`/tournaments/${id}/finish`);
      await refetchMatches();
      await refetchTournament();
      await queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] }); // щоб оновився і головний список
      toast.success('Турнір успішно завершено!');
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Помилка при завершенні турніру',
      );
    }
  };

  const isFull = participants.length >= (tournament?.maxParticipants || 0);
  const isCreatorOrAdmin = isCreator || isAdmin;

  // Збираємо всі teamId, в яких перебуває поточний юзер
  const myTeamIds = myProfiles.map((p: any) => p.teamId).filter(Boolean);
  // Перевіряємо, чи є хоча б одна його команда у списку учасників турніру
  const isAlreadyRegistered = participants.some((p: any) =>
    myTeamIds.includes(p.teamId),
  );

  // 1. МЕТОД ДЛЯ СКАСУВАННЯ (SOFT DELETE)
  const handleCancelTournament = async () => {
    try {
      await api.patch(`/tournaments/${tournament.id}/cancel`);
      await refetchMatches();
      await refetchTournament();
      // Скидаємо кеш перед переходом
      await queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Турнір успішно скасовано. Незіграні матчі анульовано.');
      navigate('/'); // Редирект на головну сторінку
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Помилка при скасуванні турніру',
      );
    }
  };

  // 2. МЕТОД ДЛЯ ПОВНОГО ВИДАЛЕННЯ (HARD DELETE)
  const handleDeleteTournament = async () => {
    try {
      await api.delete(`/tournaments/${tournament.id}`);

      toast.success(
        "Турнір та всі пов'язані заявки успішно видалені з бази даних",
      );
      navigate('/');
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Помилка при спробі видалити турнір',
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад
      </Button>

      <TournamentHeader
        tournament={tournament}
        isAdminOrCreator={isCreatorOrAdmin}
        isFull={isFull}
        isAlreadyRegistered={isAlreadyRegistered}
        hasMatches={matches.length > 0}
        onCancel={handleCancelTournament}
        onDelete={handleDeleteTournament}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex flex-wrap w-full md:w-max mb-4">
          <TabsTrigger
            value="bracket"
            className="px-6 py-2 text-xs font-black uppercase tracking-wider"
          >
            Турнірна Сітка
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="px-6 py-2 text-xs font-black uppercase tracking-wider"
          >
            Учасники ({participants.length})
          </TabsTrigger>

          {!isTournamentOver && (isCreator || isAdmin) && (
            <TabsTrigger
              value="ga-simulator"
              className="px-6 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-esports-accent"
            >
              <Cpu size={14} /> ГА-Лабораторія
            </TabsTrigger>
          )}

          {(isCreator || isAdmin) && predictionResult && (
            <TabsTrigger
              value="ga-forecast-results"
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 ${predictionResult.isLive ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 data-[state=active]:bg-emerald-500/20' : 'text-blue-400 bg-blue-500/10 border border-blue-500/20 data-[state=active]:bg-blue-500/20'}`}
            >
              <Sparkles size={14} />{' '}
              {predictionResult.isLive
                ? 'Результати Live'
                : 'Результати Прогнозу'}
              <div
                onClick={closePrediction}
                className={`ml-2 rounded-full p-0.5 transition-colors cursor-pointer ${predictionResult.isLive ? 'bg-emerald-900/50 hover:bg-emerald-500 hover:text-black' : 'bg-blue-900/50 hover:bg-red-500 hover:text-white'}`}
              >
                <X size={12} />
              </div>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="bracket">
          <TournamentBracketTab
            matches={matches}
            tournament={tournament}
            participantsCount={participants.length}
            bracketLoading={bracketLoading}
            isCreator={isCreator}
            isAdmin={isAdmin}
            onGenerateBracket={handleGenerateBracket}
            isGroupStageComplete={isGroupStageComplete}
            hasPlayoffMatches={hasPlayoffMatches}
            onTransitionToPlayoffs={handleTransitionToPlayoffs}
            onFinishTournament={handleFinishTournament}
          />
        </TabsContent>

        <TabsContent value="teams">
          <TournamentParticipantsTab
            participants={participants}
            tournamentId={tournament.id}
            tournamentTier={tournament.tier}
            tournamentGameId={tournament.gameId || tournament.game?.id}
            isCreatorOrAdmin={isCreator || isAdmin}
            isFull={participants.length >= (tournament.maxParticipants || 0)}
            isPlanned={tournament.status === 'planned'}
          />
        </TabsContent>

        <TabsContent value="ga-simulator">
          <TournamentGaSimulatorTab
            populations={populations}
            setPopulations={setPopulations}
            simLoading={simLoading}
            matchesLength={matches.length}
            tournamentStatus={tournament.status}
            isCreator={isCreator}
            isAdmin={isAdmin}
            onRunAlgorithm={runGeneticAlgorithm}
          />
        </TabsContent>

        {predictionResult && (
          <TabsContent value="ga-forecast-results">
            {(() => {
              // 1. Перевіряємо, чи є в прогнозі ШІ матчі стадії Плей-оф
              const isForecastPlayoff = enrichedPredictionBracket?.some(
                (m: any) => m.stage === 'PLAYOFF',
              );

              // 2. Визначаємо динамічний тип сітки
              const isRoundRobin =
                tournament.settings?.bracketType === 'ROUND_ROBIN';
              const forecastBracketType =
                isRoundRobin && isForecastPlayoff
                  ? tournament.settings?.playoffBracketType ||
                    'SINGLE_ELIMINATION'
                  : tournament.settings?.bracketType || 'SINGLE_ELIMINATION';

              //3. Фільтруємо старі матчі групового етапу
              // Якщо прогнозується Плей-оф стадію, ми залишаємо виключно матчі з stage === "PLAYOFF"
              const cleanForecastBracket = isForecastPlayoff
                ? enrichedPredictionBracket.filter(
                    (m: any) => m.stage === 'PLAYOFF',
                  )
                : enrichedPredictionBracket;

              return (
                <GaResultsTab
                  predictionResult={predictionResult}
                  enrichedBracket={cleanForecastBracket}
                  bracketType={forecastBracketType}
                  onGoToBracket={() => setActiveTab('bracket')}
                />
              );
            })()}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
