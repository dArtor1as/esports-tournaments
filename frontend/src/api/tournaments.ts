import { apiClient } from './client';
import type { TournamentMatch, TournamentWorkflow } from '../types/tournament';

type WorkflowMode = 'generation' | 'simulation';
type AlgorithmType = 'single-elim' | 'group-stage';
type GenerationType = 'single-elim' | 'group-stage';

type RunResult = {
  message: string;
  bestFitnessScore?: number;
  bestFitness?: number;
};

type TransitionResult = {
  message: string;
  playoffTeams: Array<{ seed: number; teamId: string; tag: string; points: number }>;
};

export const tournamentsApi = {
  listAllWorkflow: () => apiClient.get<TournamentWorkflow[]>(`/tournaments/workflow`),

  listWorkflow: (workflow: WorkflowMode) =>
    apiClient.get<TournamentWorkflow[]>(`/tournaments/workflow?workflow=${workflow}`),

  generateBracket: (tournamentId: string, type: GenerationType) =>
    type === 'group-stage'
      ? apiClient.post(`/matches/generate-groups`, { tournamentId })
      : apiClient.post(`/matches/generate-bracket`, { tournamentId }),

  transitionToPlayoffs: (tournamentId: string) =>
    apiClient.post<TransitionResult>('/matches/transition-to-playoffs', {
      tournamentId,
    }),

  runSimulation: (
    tournamentId: string,
    algorithmType: AlgorithmType,
    populations: number,
  ) =>
    algorithmType === 'group-stage'
      ? apiClient.post<RunResult>('/genetic-simulator/run-groups', {
          tournamentId,
          populations,
        })
      : apiClient.post<RunResult>('/genetic-simulator/run', {
          tournamentId,
          populations,
        }),

  listMatches: (tournamentId: string) =>
    apiClient.get<TournamentMatch[]>(`/matches/tournament/${tournamentId}`),
};
