import { BadRequestException } from '@nestjs/common';
import { GameSlug, Cs2Role, Dota2Role } from './player.enums';

export const ROLES_BY_GAME: Record<GameSlug, readonly string[]> = {
  [GameSlug.CS2]: Object.values(Cs2Role),
  [GameSlug.DOTA2]: Object.values(Dota2Role),
};

// Для кастомного валідатора (DTO)
export function isRoleAllowedForGame(
  gameSlug: GameSlug,
  role: string,
): boolean {
  const allowed = ROLES_BY_GAME[gameSlug] ?? [];
  return allowed.includes(role);
}

// Для сервісу (update)
export function assertRoleAllowedForGame(gameSlug: GameSlug, role: string) {
  if (!isRoleAllowedForGame(gameSlug, role)) {
    const allowed = ROLES_BY_GAME[gameSlug] ?? [];
    throw new BadRequestException(
      `Роль "${role}" не підходить для ${gameSlug}. Дозволено: ${allowed.join(', ')}`,
    );
  }
}
