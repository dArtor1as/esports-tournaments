import { Injectable, NotFoundException, Inject } from '@nestjs/common';
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
import { MatchesGenerationLogic } from './matches-generation.logic';

@Injectable()
export class MatchesGeneratorService {
  constructor(
    private prisma: PrismaService,
    private singleEliminationGenerator: SingleEliminationGenerator,
    private doubleEliminationGenerator: DoubleEliminationGenerator,
    private groupStageGenerator: GroupStageGenerator,
    private accessPolicy: AccessPolicyService,
    private generationLogic: MatchesGenerationLogic,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async clearGenerationCaches(tournamentId: string) {
    await this.cacheManager.del(`/matches/tournament/${tournamentId}`);
    await this.cacheManager.del(`/tournaments/${tournamentId}`);
    await this.cacheManager.del('/tournaments/workflow?workflow=generation');
    await this.cacheManager.del('/tournaments/workflow?workflow=simulation');
  }

  async generateBracket(dto: GenerateBracketDto, user: JwtPayload) {
    const { tournamentId } = dto;

    // 1. Отримання даних
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    const existingPlayoffMatches = await this.prisma.match.count({
      where: { tournamentId, stage: Stage.PLAYOFF },
    });
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId, seed: { lte: 32 } },
      orderBy: { seed: 'asc' },
      include: { team: true },
    });

    // 2. Валідація
    const teamCount = this.generationLogic.validatePlayoffGeneration(
      tournament.status,
      existingPlayoffMatches,
      dto.teamCount,
      participants.length,
    );

    const selectedParticipants = participants.slice(0, teamCount);
    const settingsData = this.generationLogic.parseSettings(
      tournament.settings,
      tournamentId,
    );

    // 3. Делегування (Router)
    let result;
    if (settingsData.bracketType === 'DOUBLE_ELIMINATION') {
      result = await this.doubleEliminationGenerator.generate(
        tournamentId,
        teamCount,
        selectedParticipants,
        tournament.format,
      );
    } else {
      result = await this.singleEliminationGenerator.generate(
        tournamentId,
        teamCount,
        selectedParticipants,
        tournament.format,
      );
    }

    // 4. Очищаємо кеш після збереження в БД
    await this.clearGenerationCaches(tournamentId);

    return result;
  }

  // Делегує генерацію кругової системи (Round Robin) для групового етапу
  async generateGroupStage(dto: GenerateBracketDto, user: JwtPayload) {
    const { tournamentId } = dto;

    // 1. Отримання даних
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Турнір не знайдено');

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

    const existingGroupMatches = await this.prisma.match.count({
      where: { tournamentId, stage: Stage.GROUP },
    });
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { team: true },
      orderBy: { seed: 'asc' },
    });

    // 2. Валідація та Парсинг
    const settingsData = this.generationLogic.parseSettings(
      tournament.settings,
      tournamentId,
    );

    const { teamCount, effectiveGroupCount } =
      this.generationLogic.validateGroupGeneration(
        tournament.status,
        existingGroupMatches,
        dto.teamCount,
        participants.length,
        dto.groupCount,
        settingsData.groupCount,
      );

    const selectedParticipants = participants.slice(0, teamCount);

    let result;

    // 3. Делегування (Router)
    result = await this.groupStageGenerator.generate(
      tournamentId,
      teamCount,
      selectedParticipants,
      tournament.format,
      effectiveGroupCount,
    );
    // 4. Очищаємо кеш після збереження в БД
    await this.clearGenerationCaches(tournamentId);

    return result;
  }
}
