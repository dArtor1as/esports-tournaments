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

// інтерфейси для множників ролей
export interface Cs2RoleMultiplier {
  kills: number;
  deaths: number;
  assists: number;
  hs_rate: number;
}

export interface Dota2RoleMultiplier {
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
}
