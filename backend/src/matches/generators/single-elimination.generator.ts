import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IBracketGenerator,
  MatchPayload,
  ParticipantInput,
} from './bracket-generator.interface';
import { v4 as uuidv4 } from 'uuid';
import { Bracket, Stage } from '@prisma/client';

@Injectable()
export class SingleEliminationGenerator implements IBracketGenerator {
  constructor(private prisma: PrismaService) {}

  async generate(
    tournamentId: string,
    teamCount: number,
    participants: ParticipantInput[],
    format: string,
  ) {
    const totalRounds = Math.log2(teamCount);
    const matchesToCreate: MatchPayload[] = [];
    let previousRoundMatches: MatchPayload[] = [];

    for (let round = totalRounds; round >= 1; round--) {
      const matchCountInRound = Math.pow(2, totalRounds - round);
      const currentRoundMatches: MatchPayload[] = [];

      for (let i = 0; i < matchCountInRound; i++) {
        const matchId = uuidv4();
        let nextMatchId: string | null = null;
        let bracketType: Bracket = Bracket.UPPER;

        if (round === totalRounds) {
          bracketType = Bracket.GRAND_FINAL;
        }

        if (round < totalRounds) {
          const parentIndex = Math.floor(i / 2);
          nextMatchId = previousRoundMatches[parentIndex].id;
        }

        const match: MatchPayload = {
          id: matchId,
          tournamentId,
          stage: Stage.PLAYOFF,
          bracket: bracketType,
          round,
          nextMatchWinnerId: nextMatchId,
          teamAId: null,
          teamBId: null,
          bestOf: format === 'TEAM' ? 3 : 1,
        };

        currentRoundMatches.push(match);
      }

      previousRoundMatches = currentRoundMatches;
      matchesToCreate.unshift(...currentRoundMatches);
    }

    const round1Matches = matchesToCreate.filter((m) => m.round === 1);

    for (let i = 0; i < teamCount / 2; i++) {
      round1Matches[i].teamAId = participants[i].teamId;
      round1Matches[i].teamBId = participants[teamCount - 1 - i].teamId;
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.match.createMany({ data: matchesToCreate });
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'live' },
      });

      return prisma.match.findMany({
        where: { tournamentId },
        orderBy: [{ round: 'asc' }],
        include: {
          teamA: { select: { tag: true } },
          teamB: { select: { tag: true } },
        },
      });
    });
  }
}
