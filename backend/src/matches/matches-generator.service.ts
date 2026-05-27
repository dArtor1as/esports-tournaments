import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { Stage } from '@prisma/client';
import { SingleEliminationGenerator } from './generators/single-elimination.generator';
import { DoubleEliminationGenerator } from './generators/double-elimination.generator';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TournamentSettings } from '../genetic-simulator/genetic-simulator.types';

@Injectable()
export class MatchesGeneratorService {
  private readonly logger = new Logger(MatchesGeneratorService.name);
  constructor(
    private prisma: PrismaService,
    private singleEliminationGenerator: SingleEliminationGenerator,
    private doubleEliminationGenerator: DoubleEliminationGenerator,
    private groupStageGenerator: GroupStageGenerator,
    private accessPolicy: AccessPolicyService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    if (tournament.status === 'finished' || tournament.status === 'cancelled') {
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
      include: { team: true },
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

    await this.cacheManager.del(`/matches/tournament/${tournamentId}`);
    await this.cacheManager.del(`/tournaments/${tournamentId}`);
    await this.cacheManager.del('/tournaments/workflow?workflow=generation');
    await this.cacheManager.del('/tournaments/workflow?workflow=simulation');

    // Безпечний парсинг налаштувань турніру для визначення формату сітки
    let settingsData: TournamentSettings =
      (tournament.settings as unknown as TournamentSettings) || {};
    if (typeof tournament.settings === 'string') {
      try {
        settingsData = JSON.parse(tournament.settings) as TournamentSettings;
      } catch (error) {
        // 👈 ВИКОРИСТОВУЄМО error ДЛЯ ЛОГУВАННЯ
        const trace = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Помилка парсингу JSON налаштувань для турніру ${tournamentId}`,
          trace,
        );

        settingsData = {} as TournamentSettings; // Фолбек до порожніх налаштувань
      }
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
    const { tournamentId } = dto;

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

    // парсинг налаштувань турніру
    let settingsData: TournamentSettings =
      (tournament.settings as unknown as TournamentSettings) || {};
    if (typeof tournament.settings === 'string') {
      try {
        settingsData = JSON.parse(tournament.settings) as TournamentSettings;
      } catch (error) {
        const trace = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Помилка парсингу JSON налаштувань (групи) для турніру ${tournamentId}`,
          trace,
        );

        settingsData = {} as TournamentSettings;
      }
    }

    //  визначаємо кількість груп
    const effectiveGroupCount = dto.groupCount ?? settingsData?.groupCount ?? 2;

    //  перевірка на ділимість та парність у групах
    if (
      teamCount % effectiveGroupCount !== 0 ||
      (teamCount / effectiveGroupCount) % 2 !== 0
    ) {
      const validGroups: number[] = [];
      for (let i = 1; i <= teamCount / 2; i++) {
        if (teamCount % i === 0 && (teamCount / i) % 2 === 0) {
          validGroups.push(i);
        }
      }

      throw new BadRequestException(
        `Неможливо розбити ${teamCount} команд на ${effectiveGroupCount} груп так, щоб у кожній була ПАРНА кількість. Допустимі варіанти кількості груп: ${
          validGroups.length > 0 ? validGroups.join(', ') : 'немає'
        }.`,
      );
    }

    const selectedParticipants = participants.slice(0, teamCount);

    await this.cacheManager.del(`/matches/tournament/${tournamentId}`);
    await this.cacheManager.del(`/tournaments/${tournamentId}`);
    await this.cacheManager.del('/tournaments/workflow?workflow=generation');
    await this.cacheManager.del('/tournaments/workflow?workflow=simulation');

    return this.groupStageGenerator.generate(
      tournamentId,
      teamCount,
      selectedParticipants,
      tournament.format,
      effectiveGroupCount,
    );
  }
}
