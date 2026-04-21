export type MapResult = {
  map: string;
  scoreA: number;
  scoreB: number;
};

// Створимо окремий type для деталей матчу
export type MatchDetails = {
  maps: MapResult[];
};

export interface MatchSimulationResult {
  winsA: number;
  winsB: number;
  mapDetails: MapResult[];
}

export interface IMatchSimulator {
  simulateSeries(
    expectedProbA: number,
    bestOf: number,
    getGeneRoll: () => number,
  ): MatchSimulationResult;
}

export interface SimulationMatch {
  id: string;
  round: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  bestOf: number;
  nextMatchWinnerId: string | null;
  details?: MatchDetails; // Використовуємо наш новий type
}

// Базовий інтерфейс для особини (хромосоми)
export interface BaseIndividual {
  genes: number[];
  fitness: number;
  bracket: SimulationMatch[];
}

// Особина для Playoff (Single Elimination)
export interface Individual extends BaseIndividual {}

// типи для групового етапу (Group Stage)

export interface GroupStanding {
  points: number;
  matchesWon: number;
  matchesLost: number;
  mapsWon: number;
  mapsLost: number;
  h2h: Record<string, number>;
}

// Особина для Group Stage (з таблицею результатів)
export interface GroupIndividual extends BaseIndividual {
  standings: Record<string, GroupStanding>;
}
