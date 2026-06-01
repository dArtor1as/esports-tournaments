import { BadRequestException } from '@nestjs/common';
import {
  isRoleAllowedForGame,
  assertRoleAllowedForGame,
} from './players-role.policy';
import { GameSlug, Cs2Role, Dota2Role } from './player.enums';

describe('PlayersRolePolicy', () => {
  describe('isRoleAllowedForGame', () => {
    it('повертає true, якщо роль дозволена для CS2', () => {
      // Беремо першу валідну роль з enum CS2
      const validCs2Role = Object.values(Cs2Role)[0] as string;
      expect(isRoleAllowedForGame(GameSlug.CS2, validCs2Role)).toBe(true);
    });

    it('повертає false, якщо роль не підходить для CS2', () => {
      // Передаємо явно невалідну роль
      expect(isRoleAllowedForGame(GameSlug.CS2, 'INVALID_ROLE')).toBe(false);
    });

    it('повертає true, якщо роль дозволена для DOTA2', () => {
      const validDotaRole = Object.values(Dota2Role)[0] as string;
      expect(isRoleAllowedForGame(GameSlug.DOTA2, validDotaRole)).toBe(true);
    });

    it('повертає false для невідомої гри (fallback)', () => {
      // Кастуємо рядок до GameSlug, щоб перевірити fallback логіку
      expect(isRoleAllowedForGame('UNKNOWN_GAME' as GameSlug, 'ANY_ROLE')).toBe(
        false,
      );
    });
  });

  describe('assertRoleAllowedForGame', () => {
    it('не викидає помилку, якщо роль валідна', () => {
      const validCs2Role = Object.values(Cs2Role)[0] as string;
      expect(() =>
        assertRoleAllowedForGame(GameSlug.CS2, validCs2Role),
      ).not.toThrow();
    });

    it('викидає BadRequestException, якщо роль не підходить для гри', () => {
      expect(() =>
        assertRoleAllowedForGame(GameSlug.CS2, 'INVALID_ROLE'),
      ).toThrow(BadRequestException);
    });

    it('викидає BadRequestException, якщо гра невідома', () => {
      expect(() =>
        assertRoleAllowedForGame('UNKNOWN_GAME' as GameSlug, 'ANY_ROLE'),
      ).toThrow(BadRequestException);
    });
  });
});
