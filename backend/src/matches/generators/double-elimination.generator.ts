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
export class DoubleEliminationGenerator implements IBracketGenerator {
  constructor(private prisma: PrismaService) {}

  async generate(
    tournamentId: string,
    teamCount: number,
    participants: ParticipantInput[],
    format: string,
  ) {
    const roundsCount = Math.log2(teamCount);
    const bestOf = format === 'TEAM' ? 3 : 1;

    const ubMatches: MatchPayload[][] = [];
    for (let r = 1; r <= roundsCount; r++) {
      const count = Math.pow(2, roundsCount - r);
      const roundMatches: MatchPayload[] = Array.from(
        { length: count },
        () => ({
          id: uuidv4(),
          tournamentId,
          stage: Stage.PLAYOFF,
          bracket: Bracket.UPPER,
          round: r,
          nextMatchWinnerId: null,
          nextMatchLoserId: null,
          teamAId: null,
          teamBId: null,
          bestOf,
        }),
      );
      ubMatches.push(roundMatches);
    }

    for (let r = 0; r < roundsCount - 1; r++) {
      for (let i = 0; i < ubMatches[r].length; i++) {
        ubMatches[r][i].nextMatchWinnerId =
          ubMatches[r + 1][Math.floor(i / 2)].id;
      }
    }

    const lbMatches: MatchPayload[][] = [];
    let lbMatchCount = teamCount / 4;
    for (let m = 1; m <= 2 * roundsCount - 2; m++) {
      const roundMatches: MatchPayload[] = Array.from(
        { length: lbMatchCount },
        () => ({
          id: uuidv4(),
          tournamentId,
          stage: Stage.PLAYOFF,
          bracket: Bracket.LOWER,
          round: m,
          nextMatchWinnerId: null,
          nextMatchLoserId: null,
          teamAId: null,
          teamBId: null,
          bestOf,
        }),
      );
      lbMatches.push(roundMatches);
      if (m % 2 === 0) lbMatchCount /= 2;
    }

    for (let m = 0; m < 2 * roundsCount - 3; m++) {
      const currentRound = lbMatches[m];
      const nextRound = lbMatches[m + 1];
      const isOddRound = (m + 1) % 2 !== 0;

      for (let i = 0; i < currentRound.length; i++) {
        if (isOddRound) {
          currentRound[i].nextMatchWinnerId = nextRound[i].id;
        } else {
          currentRound[i].nextMatchWinnerId = nextRound[Math.floor(i / 2)].id;
        }
      }
    }

    for (let i = 0; i < ubMatches[0].length; i++) {
      ubMatches[0][i].nextMatchLoserId = lbMatches[0][Math.floor(i / 2)].id;
    }

    for (let r = 1; r < roundsCount; r++) {
      const targetLBRoundIndex = 2 * r - 1;
      const targetLbRound = lbMatches[targetLBRoundIndex];
      for (let i = 0; i < ubMatches[r].length; i++) {
        const targetIndex = ubMatches[r].length - 1 - i;
        ubMatches[r][i].nextMatchLoserId = targetLbRound[targetIndex].id;
      }
    }

    const grandFinal: MatchPayload = {
      id: uuidv4(),
      tournamentId,
      stage: Stage.PLAYOFF,
      bracket: Bracket.GRAND_FINAL,
      round: 1,
      nextMatchWinnerId: null,
      nextMatchLoserId: null,
      teamAId: null,
      teamBId: null,
      bestOf: format === 'TEAM' ? 5 : 3,
    };

    ubMatches[roundsCount - 1][0].nextMatchWinnerId = grandFinal.id;
    lbMatches[lbMatches.length - 1][0].nextMatchWinnerId = grandFinal.id;

    for (let i = 0; i < teamCount / 2; i++) {
      ubMatches[0][i].teamAId = participants[i].teamId;
      ubMatches[0][i].teamBId = participants[teamCount - 1 - i].teamId;
    }

    const allMatches: MatchPayload[] = [
      ...ubMatches.flat(),
      ...lbMatches.flat(),
      grandFinal,
    ];

    return this.prisma.$transaction(async (prisma) => {
      await prisma.match.createMany({ data: allMatches });
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'live' },
      });

      return prisma.match.findMany({
        where: { tournamentId },
        orderBy: [{ bracket: 'asc' }, { round: 'asc' }],
        include: {
          teamA: { select: { tag: true } },
          teamB: { select: { tag: true } },
        },
      });
    });
  }
}
