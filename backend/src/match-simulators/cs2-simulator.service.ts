import { Injectable } from '@nestjs/common';
import {
  IMatchSimulator,
  MatchSimulationResult,
  MapResult,
} from './match-simulator.interface';

@Injectable()
export class Cs2SimulatorService implements IMatchSimulator {
  private readonly AVAILABLE_MAPS = [
    'Mirage',
    'Dust2',
    'Inferno',
    'Nuke',
    'Ancient',
    'Anubis',
    'Vertigo',
  ];
  private readonly OVERTIME_PROBABILITY = 0.15;
  private readonly ROUNDS_TO_WIN = 13;

  simulateSeries(
    expectedProbA: number,
    bestOf: number = 3,
    getGeneRoll: () => number,
  ): MatchSimulationResult {
    const mapsToWin = Math.ceil(bestOf / 2);
    let winsA = 0;
    let winsB = 0;
    const mapDetails: MapResult[] = [];
    const mapPool = [...this.AVAILABLE_MAPS];

    while (winsA < mapsToWin && winsB < mapsToWin) {
      const mapGeneRoll = getGeneRoll();
      const aWinsThisMap = mapGeneRoll <= expectedProbA;

      const mapIndex = Math.floor(Math.random() * mapPool.length);
      const mapName = mapPool.splice(mapIndex, 1)[0];

      const { scoreA, scoreB } = this.simulateMapScore(aWinsThisMap);
      mapDetails.push({ map: mapName, scoreA, scoreB });

      if (aWinsThisMap) winsA++;
      else winsB++;
    }

    return { winsA, winsB, mapDetails };
  }

  private simulateMapScore(winnerIsA: boolean): {
    scoreA: number;
    scoreB: number;
  } {
    const isOvertime = Math.random() < this.OVERTIME_PROBABILITY;

    const winnerScore = isOvertime ? 16 : this.ROUNDS_TO_WIN;
    const loserScore = isOvertime
      ? Math.floor(Math.random() * 2) + 14
      : Math.floor(Math.random() * (this.ROUNDS_TO_WIN - 1));

    return winnerIsA
      ? { scoreA: winnerScore, scoreB: loserScore }
      : { scoreA: loserScore, scoreB: winnerScore };
  }
}
