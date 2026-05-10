//import { MatchDetails } from 'src/genetic-simulator/genetic-simulator.types';
export type MapResult = {
  map: string;
  scoreA: number;
  scoreB: number;
};
export interface MatchSimulationResult {
  winsA: number;
  winsB: number;
  mapDetails: MapResult[];
  // загальна статистика гравців за весь матч
  stats: Record<string, any>;
}

export interface PlayerInput {
  id: string;
  rating: number;
  inGameRole?: string;
}

export interface TeamInput {
  id: string;
  rating: number;
  players: PlayerInput[];
}

export interface IMatchSimulator {
  simulateSeries(
    teamA: TeamInput,
    teamB: TeamInput,
    expectedProbA: number,
    bestOf: number,
    getGeneRoll: () => number,
  ): MatchSimulationResult;
}
