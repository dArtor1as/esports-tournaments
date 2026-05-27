import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IBracketGenerator,
  MatchPayload,
  ParticipantInput,
} from './bracket-generator.interface';
import { v4 as uuidv4 } from 'uuid';
import { Bracket, Stage } from '@prisma/client';
import {
  HeuristicSeedingService,
  TeamForSeeding,
} from '../heuristic-seeding.service';

@Injectable()
export class GroupStageGenerator implements IBracketGenerator {
  constructor(
    private prisma: PrismaService,
    private seedingService: HeuristicSeedingService,
  ) {}

  async generate(
    tournamentId: string,
    teamCount: number,
    participants: ParticipantInput[],
    format: string,
    groupCount: number = 4,
  ) {
    if (teamCount % groupCount !== 0) {
      throw new BadRequestException(
        `Неможливо розділити ${teamCount} команд на ${groupCount} груп порівну.`,
      );
    }

    const teamsPerGroup = teamCount / groupCount;
    if (teamsPerGroup % 2 !== 0) {
      throw new BadRequestException(
        `У кожній групі має бути парна кількість команд. Зараз виходить по ${teamsPerGroup} команд у групі. Будь ласка, оберіть іншу кількість груп.`,
      );
    }

    const teamsForSeeding: TeamForSeeding[] = participants.map((p) => ({
      id: p.teamId,
      name: p.team.name,
      rating: p.team.averageRating,
      region: p.team.region,
    }));

    const optimizedGroups = this.seedingService.generateOptimalGroups(
      teamsForSeeding,
      groupCount,
    );

    const matchesToCreate: MatchPayload[] = [];
    const bestOf = format === 'TEAM' ? 3 : 3;

    for (let gIndex = 0; gIndex < optimizedGroups.length; gIndex++) {
      const groupName = `Group ${String.fromCharCode(65 + gIndex)}`;
      const groupTeams = optimizedGroups[gIndex];

      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          matchesToCreate.push({
            id: uuidv4(),
            tournamentId,
            stage: Stage.GROUP,
            bracket: Bracket.NONE,
            groupName,
            round: 1,
            teamAId: groupTeams[i].id,
            teamBId: groupTeams[j].id,
            bestOf,
            nextMatchWinnerId: null,
            nextMatchLoserId: null,
          });
        }
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.match.createMany({ data: matchesToCreate });
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'live' },
      });

      return prisma.match.findMany({
        where: { tournamentId, stage: Stage.GROUP },
        orderBy: [{ groupName: 'asc' }, { id: 'asc' }],
        include: {
          teamA: { select: { name: true, tag: true } },
          teamB: { select: { name: true, tag: true } },
        },
      });
    });
  }
}
