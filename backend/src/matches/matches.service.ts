import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { v4 as uuidv4 } from 'uuid';
import { Stage, Bracket } from '@prisma/client';

// Додаємо інтерфейс, щоб TypeScript знав, як виглядає наш об'єкт матчу
interface MatchPayload {
  id: string;
  tournamentId: string;
  stage: Stage;
  bracket: Bracket;
  round: number;
  nextMatchWinnerId: string | null;
  teamAId: string | null;
  teamBId: string | null;
}

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  async generateSingleElimination(dto: GenerateBracketDto) {
    const { tournamentId } = dto;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    if (tournament.status !== 'planned')
      throw new BadRequestException(
        'Сітка вже згенерована або турнір завершено',
      );

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      orderBy: { seed: 'asc' },
    });

    const teamCount = participants.length;

    if (teamCount < 2 || !Number.isInteger(Math.log2(teamCount))) {
      throw new BadRequestException(
        `Для Single Elimination кількість команд має бути 2, 4, 8, 16 тощо. Зараз: ${teamCount}`,
      );
    }

    const totalRounds = Math.log2(teamCount);

    // ЯВНО ВКАЗУЄМО ТИПИ ДЛЯ МАСИВІВ
    const matchesToCreate: MatchPayload[] = [];
    let previousRoundMatches: MatchPayload[] = [];

    for (let round = totalRounds; round >= 1; round--) {
      const matchCountInRound = Math.pow(2, totalRounds - round);

      // Явно вказуємо тип
      const currentRoundMatches: MatchPayload[] = [];

      for (let i = 0; i < matchCountInRound; i++) {
        const matchId = uuidv4();
        let nextMatchId: string | null = null;

        // Явно вказуємо, що тип - це весь Enum, а не тільки UPPER
        let bracketType: Bracket = Bracket.UPPER;

        if (round === totalRounds) {
          bracketType = Bracket.GRAND_FINAL;
        }

        if (round < totalRounds) {
          const parentIndex = Math.floor(i / 2);
          nextMatchId = previousRoundMatches[parentIndex].id;
        }

        // Об'єкт тепер ідеально співпадає з MatchPayload
        const match: MatchPayload = {
          id: matchId,
          tournamentId,
          stage: Stage.PLAYOFF,
          bracket: bracketType,
          round,
          nextMatchWinnerId: nextMatchId,
          teamAId: null,
          teamBId: null,
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

  findAllByTournament(tournamentId: string) {
    return this.prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }],
      include: {
        teamA: { select: { id: true, name: true, tag: true, logoUrl: true } },
        teamB: { select: { id: true, name: true, tag: true, logoUrl: true } },
        nextMatchWinner: { select: { id: true, round: true } },
      },
    });
  }
}
