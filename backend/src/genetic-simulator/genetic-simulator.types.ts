import { Bracket, Match, Stage } from '@prisma/client';
import {
  IMatchSimulator,
  TeamInput,
} from '../match-simulators/match-simulator.interface';

export interface TournamentSettings {
  bracketType?: string;
  playoffBracketType?: string;
  groupCount?: number;
  pointsForWin?: number;
  tiebreakers?: string[];
  [key: string]: unknown;
}

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

export interface ContextParticipant {
  id: string;
  teamId: string;
  [key: string]: unknown;
}

export interface SimulationContext {
  tournament: {
    id: string;
    settings: TournamentSettings;
    participants: ContextParticipant[];
    [key: string]: unknown;
  };
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

export type Individual = BaseIndividual;

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

export interface StrategyResult {
  algorithmType: string; // 'SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION' або 'GROUP_STAGE'
  bestFitnessScore: number; // Оцінка фітнесу найкращої особини
  bracket: SimulationMatch[]; // Згенерована сітка (це і є найкращий варіант)
  executionTimeMs: number; // Час виконання алгоритму в мілісекундах
  generations: number; // Кількість пройдених поколінь

  standings?: Record<string, GroupStanding>; // Тільки для групового етапу
  message?: string; // Опціональне повідомлення
}
