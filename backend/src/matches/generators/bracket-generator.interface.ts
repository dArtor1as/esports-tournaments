import { Bracket, Stage } from '@prisma/client';

export interface MatchPayload {
  id: string;
  tournamentId: string;
  stage: Stage;
  bracket: Bracket;
  groupName?: string | null;
  round: number;
  nextMatchWinnerId: string | null;
  nextMatchLoserId?: string | null;
  teamAId: string | null;
  teamBId: string | null;
  bestOf: number;
}

export interface ParticipantInput {
  id: string;
  teamId: string;
  team: {
    id: string;
    name: string;
    region: string;
    averageRating: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface IBracketGenerator {
  generate(
    tournamentId: string,
    teamCount: number,
    participants: ParticipantInput[],
    format: string,
    groupCount?: number,
  ): Promise<any>;
}
