import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Stage, Match } from '@prisma/client';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { MatchesProgressionLogic } from './matches-progression.logic';

@Injectable()
export class MatchesProgressionService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
    private progressionLogic: MatchesProgressionLogic,
  ) {}

  public async finalizeMatchProgression(
    prismaTx: Prisma.TransactionClient,
    match: Match,
    scoreA: number,
    scoreB: number,
  ) {
    // 1. Читаємо наступні матчі з бази (I/O)
    const nextWinnerMatch = match.nextMatchWinnerId
      ? await prismaTx.match.findUnique({
          where: { id: match.nextMatchWinnerId },
        })
      : null;
    const nextLoserMatch = match.nextMatchLoserId
      ? await prismaTx.match.findUnique({
          where: { id: match.nextMatchLoserId },
        })
      : null;

    // 2. Отримуємо команди для апдейту від чистої логіки (Без БД)
    const updates = this.progressionLogic.calculateProgressionUpdates(
      match,
      scoreA,
      scoreB,
      nextWinnerMatch,
      nextLoserMatch,
    );

    // 3. Застосовуємо команди до БД
    let updatedCurrentMatch: Match | null = null;
    for (const update of updates) {
      const res = await prismaTx.match.update({
        where: { id: update.id },
        data: update.data,
      });
      if (update.id === match.id) updatedCurrentMatch = res;
    }

    return updatedCurrentMatch;
  }

  // Аналізує результати групового етапу, визначає Топ-2 команди кожної групи
  // та оновлює їхні посіви (seed) для подальшої участі у Плей-оф.
  async transitionToPlayoffs(tournamentId: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    // Витягуємо всі матчі групи для визначення приналежності команд до груп
    const groupMatches = await this.prisma.match.findMany({
      where: { tournamentId, stage: Stage.GROUP },
      select: {
        teamAId: true,
        teamBId: true,
        groupName: true,
        isProcessed: true,
        scoreA: true,
        scoreB: true,
      },
    });

    if (!groupMatches.length)
      throw new BadRequestException('Групові матчі не знайдені');
    if (!groupMatches.every((m) => m.isProcessed)) {
      throw new BadRequestException('Не всі матчі групового етапу завершені.');
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { team: { select: { tag: true } } },
    });

    // Мапимо команди до їхніх груп на основі історії матчів
    const teamGroupMap = new Map<string, string>();
    for (const match of groupMatches) {
      if (match.teamAId && match.groupName)
        teamGroupMap.set(match.teamAId, match.groupName);
      if (match.teamBId && match.groupName)
        teamGroupMap.set(match.teamBId, match.groupName);
    }

    const groupedParticipants: Record<string, typeof participants> = {};
    for (const p of participants) {
      const groupName = teamGroupMap.get(p.teamId);
      if (!groupName) continue;
      if (!groupedParticipants[groupName]) groupedParticipants[groupName] = [];
      groupedParticipants[groupName].push(p);
    }

    type ParticipantWithTeam = (typeof participants)[0];
    const firstPlaces: ParticipantWithTeam[] = [];
    const secondPlaces: ParticipantWithTeam[] = [];

    // ДЕЛЕГУЄМО СОРТУВАННЯ ЧИСТІЙ ЛОГІЦІ
    for (const groupName in groupedParticipants) {
      const groupSpecificMatches = groupMatches.filter(
        (match) => match.groupName === groupName,
      );
      const sortedGroup = this.progressionLogic.sortGroupTeams(
        groupedParticipants[groupName],
        groupSpecificMatches,
      );

      if (sortedGroup[0]) firstPlaces.push(sortedGroup[0]);
      if (sortedGroup[1]) secondPlaces.push(sortedGroup[1]);
    }

    const sortedFirstPlaces = this.progressionLogic.sortGroupTeams(firstPlaces);
    const sortedSecondPlaces =
      this.progressionLogic.sortGroupTeams(secondPlaces);
    const playoffTeams = [...sortedFirstPlaces, ...sortedSecondPlaces];

    // Оновлюємо посіви (seed) в базі даних: 1-8 для тих, хто пройшов, 99 для решти
    await this.prisma.$transaction(
      participants.map((p) => {
        const playoffIndex = playoffTeams.findIndex((pt) => pt.id === p.id);
        const newSeed = playoffIndex !== -1 ? playoffIndex + 1 : 99;

        return this.prisma.tournamentParticipant.update({
          where: { id: p.id },
          data: { seed: newSeed },
        });
      }),
    );

    return {
      message:
        'Перехід до плей-оф виконано. Топ-8 команд отримали нові посіви.',
      playoffTeams: playoffTeams.map((t, index) => ({
        seed: index + 1,
        teamId: t.teamId,
        tag: t.team.tag,
        points: t.groupPoints,
      })),
    };
  }
}
