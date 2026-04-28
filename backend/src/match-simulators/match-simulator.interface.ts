export type MapResult = {
  map: string;
  scoreA: number;
  scoreB: number;
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
