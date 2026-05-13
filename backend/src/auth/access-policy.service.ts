import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AccessPolicyService {
  // 1. SELF_OR_ADMIN (Для юзерів та гравців)
  checkSelfOrAdmin(resourceUserId: string, currentUser: JwtPayload) {
    if (resourceUserId !== currentUser.userId && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Ви не можете редагувати або видаляти чужий профіль',
      );
    }
  }

  // 2. CAPTAIN_OR_ADMIN (Для команд)
  checkCaptainOrAdmin(captainUserId: string, currentUser: JwtPayload) {
    if (captainUserId !== currentUser.userId && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Тільки капітан команди або адміністратор має право на цю дію',
      );
    }
  }

  // 3. TOURNAMENT_CREATOR_OR_ADMIN (Для турнірів та генерації матчів)
  checkTournamentCreatorOrAdmin(creatorId: string, currentUser: JwtPayload) {
    if (creatorId !== currentUser.userId && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Тільки організатор турніру або адміністратор має доступ до цієї дії',
      );
    }
  }

  // 4. TEAM_CAPTAIN_OR_TOURNAMENT_CREATOR_OR_ADMIN (Для турнірних учасників)
  checkTeamCaptainOrTournamentCreatorOrAdmin(
    captainUserId: string,
    tournamentCreatorId: string,
    currentUser: JwtPayload,
  ) {
    if (
      captainUserId !== currentUser.userId &&
      tournamentCreatorId !== currentUser.userId &&
      currentUser.role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Цю дію може виконати лише капітан команди, організатор турніру або адміністратор',
      );
    }
  }
}
