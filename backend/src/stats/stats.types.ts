// src/stats/stats.types.ts

export interface BasePlayerStat {
  playerId: string;
  [key: string]: string | number; // Дозволяє динамічний доступ до полів
}

export interface Cs2PlayerStat extends BasePlayerStat {
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  headshots: number;
}

export interface Dota2PlayerStat extends BasePlayerStat {
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  netWorth: number;
}

export type GamePlayerStat = Cs2PlayerStat | Dota2PlayerStat;

export interface BaseMapStat {
  mapName: string;
  durationMinutes: number;
  teamA: { score: number; players: GamePlayerStat[] };
  teamB: { score: number; players: GamePlayerStat[] };
}

export interface MatchStatsJson {
  durationMinutes: number;
  maps: BaseMapStat[];
}
