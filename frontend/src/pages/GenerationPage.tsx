import { useEffect, useMemo, useState } from 'react';
import { tournamentsApi } from '../api/tournaments';
import type { TournamentWorkflow } from '../types/tournament';

type GenerationType = 'single-elim' | 'group-stage';

export function GenerationPage() {
  const [items, setItems] = useState<TournamentWorkflow[]>([]);
  const [transitionItems, setTransitionItems] = useState<TournamentWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [transitionTournamentId, setTransitionTournamentId] = useState('');
  const [generationType, setGenerationType] =
    useState<GenerationType>('single-elim');
  const [teamCount, setTeamCount] = useState<number>(16);
  const [groupCount, setGroupCount] = useState<number>(4);
  const [testTournamentTeamCount, setTestTournamentTeamCount] =
    useState<number>(16);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [result, allWorkflow] = await Promise.all([
        tournamentsApi.listWorkflow('generation'),
        tournamentsApi.listAllWorkflow(),
      ]);
      setItems(result);
      const transitionCandidates = allWorkflow.filter(
        (item) => item.requiresTransitionToPlayoffs,
      );
      setTransitionItems(transitionCandidates);
      const hasCurrent = result.some((item) => item.id === selectedTournamentId);
      if (!hasCurrent) {
        setSelectedTournamentId(result[0]?.id ?? '');
      }
      const hasTransitionCurrent = transitionCandidates.some(
        (item) => item.id === transitionTournamentId,
      );
      if (!hasTransitionCurrent) {
        setTransitionTournamentId(transitionCandidates[0]?.id ?? '');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedTournament = useMemo(
    () => items.find((item) => item.id === selectedTournamentId),
    [items, selectedTournamentId],
  );
  const transitionSelected = useMemo(
    () =>
      transitionItems.find((item) => item.id === transitionTournamentId) ??
      transitionItems[0],
    [transitionItems, transitionTournamentId],
  );

  async function onGenerate() {
    if (!selectedTournamentId) {
      setError('Спочатку вибери турнір.');
      return;
    }
    if (generationType === 'single-elim') {
      if (![2, 4, 8, 16, 32].includes(teamCount)) {
        setError('Для Single Elimination кількість команд має бути 2, 4, 8, 16 або 32.');
        return;
      }
    } else if (teamCount < 4 || teamCount > 32) {
      setError('Для Group Stage кількість команд має бути в діапазоні 4..32.');
      return;
    }

    if (generationType === 'group-stage' && groupCount < 2) {
      setError('Кількість груп має бути щонайменше 2.');
      return;
    }

    if (generationType === 'group-stage' && teamCount % groupCount !== 0) {
      setError('Кількість команд має ділитися на кількість груп без остачі.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await tournamentsApi.generateBracket(selectedTournamentId, generationType, {
        teamCount,
        groupCount: generationType === 'group-stage' ? groupCount : undefined,
      });
      setSuccess('Сітку успішно згенеровано.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onTransitionToPlayoffs() {
    if (!transitionTournamentId) {
      setError('Спочатку вибери турнір.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response =
        await tournamentsApi.transitionToPlayoffs(transitionTournamentId);
      setSuccess(response.message);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function onCreateTestTournament() {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response =
        await tournamentsApi.generateTestTournament(testTournamentTeamCount);
      setSuccess(`${response.message} ID: ${response.tournamentId}`);
      await load();
      setSelectedTournamentId(response.tournamentId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Генерація сітки</h2>
      <p>Список турнірів автоматично фільтрується по workflow generation.</p>

      <section className="sub-card">
        <h3>Створення тестового турніру</h3>
        <div className="form-grid">
          <label>
            Кількість команд
            <select
              value={testTournamentTeamCount}
              onChange={(event) =>
                setTestTournamentTeamCount(Number(event.target.value))
              }
              disabled={actionLoading}
            >
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
          </label>
        </div>
        <div className="actions-row">
          <button onClick={onCreateTestTournament} disabled={actionLoading}>
            {actionLoading ? 'Обробка...' : 'Створити тестовий турнір'}
          </button>
        </div>
      </section>

      <div className="form-grid">
        <label>
          Турнір (готовий до генерації)
          <select
            value={selectedTournamentId}
            onChange={(event) => setSelectedTournamentId(event.target.value)}
            disabled={loading || items.length === 0}
          >
            {items.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.title} ({tournament.gameName})
              </option>
            ))}
          </select>
        </label>

        <label>
          Тип генерації
          <select
            value={generationType}
            onChange={(event) =>
              setGenerationType(event.target.value as GenerationType)
            }
          >
            <option value="single-elim">Single Elimination</option>
            <option value="group-stage">Group Stage (Round Robin)</option>
          </select>
        </label>

        <label>
          Кількість команд (top-N за seed)
          <select
            value={teamCount}
            onChange={(event) => setTeamCount(Number(event.target.value))}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
          </select>
        </label>

        {generationType === 'group-stage' && (
          <label>
            Кількість груп
            <input
              type="number"
              min={2}
              max={16}
              value={groupCount}
              onChange={(event) => setGroupCount(Number(event.target.value))}
            />
          </label>
        )}
      </div>

      <div className="actions-row">
        <button onClick={onGenerate} disabled={actionLoading || loading}>
          {actionLoading ? 'Обробка...' : 'Згенерувати'}
        </button>
      </div>

      <section className="sub-card">
        <h3>Переведення Group Stage → Playoffs</h3>
        <p>
          Тут показані турніри, де вже є GROUP-матчі, але ще немає PLAYOFF-матчів.
        </p>
        <div className="form-grid">
          <label>
            Турнір для transition
            <select
              value={transitionSelected?.id ?? ''}
              onChange={(event) => setTransitionTournamentId(event.target.value)}
              disabled={actionLoading || loading || transitionItems.length === 0}
            >
              {transitionItems.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.title} ({tournament.status})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="actions-row">
          <button
            onClick={onTransitionToPlayoffs}
            disabled={actionLoading || loading || !transitionSelected}
          >
            Transition to Playoffs
          </button>
        </div>
      </section>

      {selectedTournament && (
        <div className="inline-stats">
          <span>Group matches: {selectedTournament.groupMatches}</span>
          <span>Playoff matches: {selectedTournament.playoffMatches}</span>
          <span>Status: {selectedTournament.status}</span>
        </div>
      )}

      {loading && <p>Завантаження турнірів...</p>}
      {error && <p className="message error">{error}</p>}
      {success && <p className="message success">{success}</p>}
    </section>
  );
}
