import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { Stage } from '@prisma/client';
import { SingleEliminationGenerator } from './generators/single-elimination.generator';
import { DoubleEliminationGenerator } from './generators/double-elimination.generator';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Injectable()
export class MatchesGeneratorService {
  constructor(
    private prisma: PrismaService,
    private singleEliminationGenerator: SingleEliminationGenerator,
    private doubleEliminationGenerator: DoubleEliminationGenerator,
    private groupStageGenerator: GroupStageGenerator,
    private accessPolicy: AccessPolicyService,
  ) {}

  // Маршрутизатор для генерації сітки Плей-оф.
  // Читає налаштування турніру та делегує створення матчу відповідній стратегії.
  async generateBracket(dto: GenerateBracketDto, user: JwtPayload) {
    const { tournamentId } = dto;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);
    if (tournament.status === 'finished') {
      throw new BadRequestException('Турнір вже завершено');
    }

    const existingPlayoffMatches = await this.prisma.match.count({
      where: { tournamentId, stage: Stage.PLAYOFF },
    });
    if (existingPlayoffMatches > 0) {
      throw new BadRequestException('Сітка плей-оф вже згенерована');
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId, seed: { lte: 32 } },
      orderBy: { seed: 'asc' },
    });

    const requestedTeamCount = dto.teamCount;
    const teamCount = requestedTeamCount ?? participants.length;

    if (requestedTeamCount && requestedTeamCount > participants.length) {
      throw new BadRequestException(
        `Недостатньо учасників. Зареєстровано: ${participants.length}.`,
      );
    }

    if (teamCount < 4 || !Number.isInteger(Math.log2(teamCount))) {
      throw new BadRequestException(
        `Кількість команд має бути 4, 8, 16, 32 тощо. Зараз: ${teamCount}`,
      );
    }

    const selectedParticipants =
      requestedTeamCount && requestedTeamCount < participants.length
        ? participants.slice(0, requestedTeamCount)
        : participants;

    // Безпечний парсинг налаштувань турніру для визначення формату сітки
    let settingsData: any = tournament.settings || {};
    if (typeof settingsData === 'string') {
      try {
        settingsData = JSON.parse(settingsData);
      } catch (e) {}
    }
    const bracketType = settingsData?.bracketType;

    // Делегування генерації
    if (bracketType === 'DOUBLE_ELIMINATION') {
      return this.doubleEliminationGenerator.generate(
        tournamentId,
        teamCount,
        selectedParticipants,
        tournament.format,
      );
    }

    return this.singleEliminationGenerator.generate(
      tournamentId,
      teamCount,
      selectedParticipants,
      tournament.format,
    );
  }

  // Делегує генерацію кругової системи (Round Robin) для групового етапу
  async generateGroupStage(dto: GenerateBracketDto, user: JwtPayload) {
    const { tournamentId, groupCount = 4 } = dto;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);
    if (tournament.status !== 'planned') {
      throw new BadRequestException(
        'Групи вже згенеровані або турнір завершено',
      );
    }

    const existingGroupMatches = await this.prisma.match.count({
      where: { tournamentId, stage: Stage.GROUP },
    });
    if (existingGroupMatches > 0) {
      throw new BadRequestException('Груповий етап вже згенеровано');
    }

    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { team: true },
      orderBy: { seed: 'asc' },
    });

    const teamCount = dto.teamCount ?? participants.length;

    if (teamCount < 4) {
      throw new BadRequestException(
        'Для групового етапу потрібно мінімум 4 команди',
      );
    }

    const selectedParticipants = participants.slice(0, teamCount);

    return this.groupStageGenerator.generate(
      tournamentId,
      teamCount,
      selectedParticipants,
      tournament.format,
      groupCount,
    );
  }
}
