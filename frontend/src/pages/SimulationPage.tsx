import { useEffect, useMemo, useState } from 'react';
import { tournamentsApi } from '../api/tournaments';
import type {
  SimulationRun,
  TournamentMatch,
  TournamentWorkflow,
} from '../types/tournament';
import { GroupTables } from '../components/groups/GroupTables';
import { PlayoffBracket } from '../components/bracket/PlayoffBracket';

type AlgorithmType = 'single-elim' | 'group-stage';

export function SimulationPage() {
  const [items, setItems] = useState<TournamentWorkflow[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [algorithmType, setAlgorithmType] = useState<AlgorithmType>('single-elim');
  const [populations, setPopulations] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bestFitness, setBestFitness] = useState<number | null>(null);
  const [runs, setRuns] = useState<SimulationRun[]>([]);

  const selectedTournament = useMemo(
    () => items.find((item) => item.id === selectedTournamentId),
    [items, selectedTournamentId],
  );

  async function loadTournaments() {
    setLoading(true);
    setError(null);
    try {
      const result = await tournamentsApi.listWorkflow('simulation');
      setItems(result);
      const hasCurrent = result.some((item) => item.id === selectedTournamentId);
      if (!hasCurrent) {
        const fallbackId = result[0]?.id ?? '';
        setSelectedTournamentId(fallbackId);
        if (!fallbackId) {
          setMatches([]);
          setRuns([]);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMatches(tournamentId: string) {
    try {
      const result = await tournamentsApi.listMatches(tournamentId);
      setMatches(result);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function loadRuns(tournamentId: string) {
    try {
      const result = await tournamentsApi.listSimulationRuns(tournamentId);
      setRuns(result);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      void Promise.all([
        loadMatches(selectedTournamentId),
        loadRuns(selectedTournamentId),
      ]);
    } else {
      setMatches([]);
      setRuns([]);
    }
  }, [selectedTournamentId]);

  async function onRun() {
    if (!selectedTournamentId) {
      setError('Спочатку вибери турнір.');
      return;
    }
    if (populations < 10 || populations > 1000) {
      setError('Populations має бути в діапазоні 10..1000.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);
    setBestFitness(null);
    try {
      const result = await tournamentsApi.runSimulation(
        selectedTournamentId,
        algorithmType,
        populations,
      );
      setSuccess(result.message || 'Симуляцію завершено.');
      const fitnessValue = result.bestFitnessScore ?? result.bestFitness;
      setBestFitness(typeof fitnessValue === 'number' ? fitnessValue : null);
      await loadMatches(selectedTournamentId);
      await loadRuns(selectedTournamentId);
      await loadTournaments();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Симуляція та візуалізація</h2>

      <div className="form-grid">
        <label>
          Турнір (із згенерованою сіткою)
          <select
            value={selectedTournamentId}
            onChange={(event) => setSelectedTournamentId(event.target.value)}
            disabled={loading || items.length === 0}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} [{item.status}]
              </option>
            ))}
          </select>
        </label>

        <label>
          Тип алгоритму
          <select
            value={algorithmType}
            onChange={(event) =>
              setAlgorithmType(event.target.value as AlgorithmType)
            }
          >
            <option value="single-elim">Single Elimination</option>
            <option value="group-stage">Group Stage</option>
          </select>
        </label>

        <label>
          Populations
          <input
            type="number"
            min={10}
            max={1000}
            value={populations}
            onChange={(event) => setPopulations(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="actions-row">
        <button onClick={onRun} disabled={actionLoading || loading}>
          {actionLoading ? 'Обробка...' : 'Запустити GA'}
        </button>
      </div>

      {selectedTournament && (
        <div className="inline-stats">
          <span>Group matches: {selectedTournament.groupMatches}</span>
          <span>Playoff matches: {selectedTournament.playoffMatches}</span>
          <span>Status: {selectedTournament.status}</span>
        </div>
      )}

      {loading && <p>Завантаження...</p>}
      {error && <p className="message error">{error}</p>}
      {success && <p className="message success">{success}</p>}
      {bestFitness !== null && (
        <p className="message fitness">
          Найкраща фітнес-функція: <strong>{bestFitness.toFixed(2)}</strong>
        </p>
      )}

      <div className="visualization-grid">
        <PlayoffBracket matches={matches} />
        <GroupTables matches={matches} />
      </div>

      <section className="sub-card">
        <h3>Історія симуляцій</h3>
        {runs.length === 0 ? (
          <p>Ще немає запусків для цього турніру.</p>
        ) : (
          <div className="table-wrap">
            <table className="runs-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Populations</th>
                  <th>Fitness</th>
                  <th>Час (ms)</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.createdAt).toLocaleString()}</td>
                    <td>{run.algorithmType}</td>
                    <td>{run.populations}</td>
                    <td>{run.fitnessScore.toFixed(2)}</td>
                    <td>{run.executionTimeMs ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
