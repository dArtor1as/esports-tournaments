export interface BasePlayerStat {
  playerId: string;
  rating?: number; // Додаємо опціонально для потреб симулятора
  [key: string]: string | number | undefined; // Дозволяє динамічний доступ до полів
}

export interface Cs2PlayerStat extends BasePlayerStat {
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  headshots: number;
  roundsPlayed: number;
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

export interface BaseMapStat<T = GamePlayerStat> {
  mapName: string;
  durationMinutes: number;
  teamA: { score: number; players: T[] };
  teamB: { score: number; players: T[] };
}

export interface MatchStatsJson {
  durationMinutes: number;
  maps: BaseMapStat[];
}
