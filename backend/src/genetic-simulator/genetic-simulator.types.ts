import { Bracket, Match, Stage } from '@prisma/client';
import {
  IMatchSimulator,
  TeamInput,
} from '../match-simulators/match-simulator.interface';

// Використовуємо універсальний Record для деталей і статів
export interface SimulationMatch {
  id: string;
  stage: Stage;
  bracket: Bracket;
  groupName?: string | null;
  round: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  bestOf: number;
  nextMatchWinnerId: string | null;
  nextMatchLoserId: string | null;
  details?: Record<string, any>;
  stats?: Record<string, any>;
}

// Спільний інтерфейс для контексту, який ми будемо передавати в стратегії
export interface SimulationContext {
  tournament: any;
  simulator: IMatchSimulator;
  pastMatches: Match[];
  teamRatings: Record<string, number>;
  teamsData: Record<string, TeamInput>;
  baseSkeleton: SimulationMatch[];
  estimatedGenesNeeded: number;
  matchCount: number;
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
