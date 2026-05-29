import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import { AccessPolicyService } from '../auth/access-policy.service';

// Визначаємо тип матчу з усіма необхідними зв'язками для консенсусу
export type ConsensusMatch = Prisma.MatchGetPayload<{
  include: {
    tournament: true;
    teamA: { include: { captain: true } };
    teamB: { include: { captain: true } };
  };
}>;

@Injectable()
export class MatchesConsensusLogic {
  constructor(private accessPolicy: AccessPolicyService) {}

  public resolveForfeit(
    match: ConsensusMatch,
    dto: ForfeitMatchDto,
    user: JwtPayload,
  ): { scoreA: number; scoreB: number } {
    if (match.isProcessed)
      throw new BadRequestException('Цей матч вже завершено');
    if (match.tournament.status !== 'live')
      throw new BadRequestException('Турнір не активний');
    if (!match.teamAId || !match.teamBId) {
      throw new BadRequestException(
        'В цьому матчі ще не визначені обидва опоненти',
      );
    }

    let isTeamAForfeiting = false;
    // 1. Визначаємо , чи діє капітан
    const isCaptainA = match.teamA?.captain?.userId === user.userId;
    const isCaptainB = match.teamB?.captain?.userId === user.userId;

    if (isCaptainA) {
      isTeamAForfeiting = true;
    } else if (isCaptainB) {
      isTeamAForfeiting = false; // B здається, отже А перемагає
    } else {
      // 2. Якщо це не капітан, перевіряємо права Організатора або Адміна
      this.accessPolicy.checkTournamentCreatorOrAdmin(
        match.tournament.creatorId,
        user,
      );

      // Якщо виклик вище не кинув ForbiddenException, значить це адмін/креатор
      if (!dto.forfeitingTeamId) {
        throw new BadRequestException(
          'Адміністратор або Організатор повинен вказати ID команди, яку дискваліфікують',
        );
      }
      if (dto.forfeitingTeamId === match.teamAId) {
        isTeamAForfeiting = true;
      } else if (dto.forfeitingTeamId === match.teamBId) {
        isTeamAForfeiting = false;
      } else {
        throw new BadRequestException(
          'Вказана команда не бере участі в цьому матчі',
        );
      }
    }

    // 3. Визначаємо рахунок (Технічна перемога залежить від формату: 1:0, 2:0 або 3:0)
    const pointsToWin = Math.ceil(match.bestOf / 2);
    return {
      scoreA: isTeamAForfeiting ? 0 : pointsToWin,
      scoreB: isTeamAForfeiting ? pointsToWin : 0,
    };
  }

  public validateReport(match: ConsensusMatch, user: JwtPayload) {
    if (match.matchStatus === 'COMPLETED') {
      throw new BadRequestException('Матч недоступний для звітування');
    }

    const isCaptainA = match.teamA?.captain?.userId === user.userId;
    const isCaptainB = match.teamB?.captain?.userId === user.userId;

    if (!isCaptainA && !isCaptainB) {
      throw new ForbiddenException('Тільки капітани можуть вносити рахунок');
    }
  }

  public validateConfirm(match: ConsensusMatch, user: JwtPayload) {
    if (match.matchStatus !== 'REPORTED') {
      throw new BadRequestException('Немає рахунку для підтвердження');
    }

    const isCaptainA = match.teamA?.captain?.userId === user.userId;
    const isCaptainB = match.teamB?.captain?.userId === user.userId;

    if (!isCaptainA && !isCaptainB) {
      throw new ForbiddenException('Тільки капітан може підтвердити');
    }
    if (match.reportedById === user.userId) {
      throw new BadRequestException(
        'Ви не можете підтвердити власний звіт. Чекайте на опонента.',
      );
    }
  }

  public validateDispute(match: ConsensusMatch, user: JwtPayload) {
    if (match.matchStatus !== 'REPORTED') {
      throw new BadRequestException('Неможливо оскаржити');
    }
    if (match.reportedById === user.userId) {
      throw new BadRequestException('Ви не можете оскаржити власний звіт');
    }
  }

  public validateForceResolve(match: ConsensusMatch, user: JwtPayload) {
    if (match.matchStatus === 'COMPLETED') {
      throw new BadRequestException('Матч вже закритий');
    }
    this.accessPolicy.checkTournamentCreatorOrAdmin(
      match.tournament.creatorId,
      user,
    );
  }
}
