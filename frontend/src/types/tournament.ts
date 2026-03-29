export type TournamentWorkflow = {
  id: string;
  title: string;
  status: string;
  format: string;
  gameName: string;
  participantsCount: number;
  totalMatches: number;
  groupMatches: number;
  playoffMatches: number;
  canGenerateBracket: boolean;
  hasGeneratedGrid: boolean;
  requiresTransitionToPlayoffs: boolean;
};

export type MatchStage = 'GROUP' | 'PLAYOFF' | 'CQ';

export type TeamSummary = {
  id: string;
  name: string;
  tag: string;
  logoUrl?: string | null;
};

export type TournamentMatch = {
  id: string;
  tournamentId: string;
  stage: MatchStage;
  groupName?: string | null;
  round: number;
  scoreA: number;
  scoreB: number;
  bestOf: number;
  teamA?: TeamSummary | null;
  teamB?: TeamSummary | null;
  nextMatchWinner?: { id: string; round: number } | null;
};
