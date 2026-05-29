import { BadRequestException } from '@nestjs/common';
import { Player, TeamInvitation, Team, Game } from '@prisma/client';

type InviteWithRelations = TeamInvitation & { team: Team & { game: Game } };

export class TeamInvitationsLogic {
  // 1. Усі перевірки інвайту та гравця в одному місці
  static validateAcceptance(
    invite: InviteWithRelations,
    player: Player,
    userId: string,
  ) {
    if (invite.status !== 'PENDING')
      throw new BadRequestException('Запрошення вже оброблено');
    if (invite.expiresAt < new Date())
      throw new BadRequestException('Термін дії запрошення минув');
    if (invite.userId !== userId)
      throw new BadRequestException(
        'Це запрошення адресоване іншому користувачу',
      );

    if (player.gameId !== invite.team.gameId) {
      throw new BadRequestException(
        'Цей ігровий профіль належить до іншої гри, ніж команда, яка вас запрошує',
      );
    }
    if (player.userId !== userId)
      throw new BadRequestException('Цей ігровий профіль вам не належить');
    if (player.teamId)
      throw new BadRequestException('Цей ігровий профіль вже в команді');
  }

  // 2. Визначення ролі (всього 3 рядки логіки!)
  static determineTeamRole(
    inGameRole: string | null,
    activePlayersCount: number,
    requiredSize: number,
  ): 'PLAYER' | 'COACH' | 'SUBSTITUTE' {
    if (inGameRole === 'COACH') return 'COACH';
    if (activePlayersCount >= requiredSize) return 'SUBSTITUTE';
    return 'PLAYER';
  }

  // 3. Перерахунок ELO (повертає результат, а не лізе в БД)
  static calculateTeamRating(
    teamPlayers: { rating: number; teamRole: string | null }[],
    newPlayerRating: number,
    newPlayerRole: 'PLAYER' | 'COACH' | 'SUBSTITUTE',
    requiredSize: number,
    currentActiveCount: number,
  ): { isComplete: boolean; newAverageRating?: number } {
    const newActiveCount =
      newPlayerRole === 'PLAYER' ? currentActiveCount + 1 : currentActiveCount;
    const isTeamNowComplete = newActiveCount >= requiredSize;

    if (!isTeamNowComplete) {
      return { isComplete: false };
    }

    // Рахуємо рейтинг тільки по гравцях основи (CAPTAIN + існуючі PLAYER)
    const activeRatings = teamPlayers
      .filter((p) => p.teamRole === 'PLAYER' || p.teamRole === 'CAPTAIN')
      .map((p) => p.rating);

    // Додаємо нового гравця, якщо він зайшов в основу
    if (newPlayerRole === 'PLAYER') {
      activeRatings.push(newPlayerRating);
    }

    const totalRating = activeRatings.reduce((sum, r) => sum + r, 0);
    const newAverageRating = Math.floor(totalRating / activeRatings.length);

    return { isComplete: true, newAverageRating };
  }
}
