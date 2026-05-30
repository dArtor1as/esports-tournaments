import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AccessPolicyService } from './access-policy.service';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

describe('AccessPolicyService', () => {
  let service: AccessPolicyService;

  beforeEach(() => {
    service = new AccessPolicyService();
  });

  describe('checkSelfOrAdmin', () => {
    it('allows self', () => {
      const user: JwtPayload = {
        userId: 'u1',
        email: 'u1@example.com',
        role: Role.USER,
      };

      expect(() => service.checkSelfOrAdmin('u1', user)).not.toThrow();
    });

    it('allows admin', () => {
      const user: JwtPayload = {
        userId: 'u2',
        email: 'admin@example.com',
        role: Role.ADMIN,
      };

      expect(() => service.checkSelfOrAdmin('u1', user)).not.toThrow();
    });

    it('throws when not self and not admin', () => {
      const user: JwtPayload = {
        userId: 'u2',
        email: 'u2@example.com',
        role: Role.USER,
      };

      expect(() => service.checkSelfOrAdmin('u1', user)).toThrow(
        new ForbiddenException(
          'Ви не можете редагувати або видаляти чужий профіль',
        ),
      );
    });
  });

  describe('checkCaptainOrAdmin', () => {
    it('allows captain', () => {
      const user: JwtPayload = {
        userId: 'u1',
        email: 'u1@example.com',
        role: Role.USER,
      };

      expect(() => service.checkCaptainOrAdmin('u1', user)).not.toThrow();
    });

    it('allows admin', () => {
      const user: JwtPayload = {
        userId: 'u2',
        email: 'admin@example.com',
        role: Role.ADMIN,
      };

      expect(() => service.checkCaptainOrAdmin('u1', user)).not.toThrow();
    });

    it('throws when not captain and not admin', () => {
      const user: JwtPayload = {
        userId: 'u2',
        email: 'u2@example.com',
        role: Role.USER,
      };

      expect(() => service.checkCaptainOrAdmin('u1', user)).toThrow(
        new ForbiddenException(
          'Тільки капітан команди або адміністратор має право на цю дію',
        ),
      );
    });
  });

  describe('checkTournamentCreatorOrAdmin', () => {
    it('allows creator', () => {
      const user: JwtPayload = {
        userId: 'u1',
        email: 'u1@example.com',
        role: Role.USER,
      };

      expect(() =>
        service.checkTournamentCreatorOrAdmin('u1', user),
      ).not.toThrow();
    });

    it('allows admin', () => {
      const user: JwtPayload = {
        userId: 'u2',
        email: 'admin@example.com',
        role: Role.ADMIN,
      };

      expect(() =>
        service.checkTournamentCreatorOrAdmin('u1', user),
      ).not.toThrow();
    });

    it('throws when not creator and not admin', () => {
      const user: JwtPayload = {
        userId: 'u2',
        email: 'u2@example.com',
        role: Role.USER,
      };

      expect(() => service.checkTournamentCreatorOrAdmin('u1', user)).toThrow(
        new ForbiddenException(
          'Тільки організатор турніру або адміністратор має доступ до цієї дії',
        ),
      );
    });
  });

  describe('checkTeamCaptainOrTournamentCreatorOrAdmin', () => {
    it('allows captain', () => {
      const user: JwtPayload = {
        userId: 'u1',
        email: 'u1@example.com',
        role: Role.USER,
      };

      expect(() =>
        service.checkTeamCaptainOrTournamentCreatorOrAdmin('u1', 'u3', user),
      ).not.toThrow();
    });

    it('allows tournament creator', () => {
      const user: JwtPayload = {
        userId: 'u2',
        email: 'u2@example.com',
        role: Role.USER,
      };

      expect(() =>
        service.checkTeamCaptainOrTournamentCreatorOrAdmin('u1', 'u2', user),
      ).not.toThrow();
    });

    it('allows admin', () => {
      const user: JwtPayload = {
        userId: 'u4',
        email: 'admin@example.com',
        role: Role.ADMIN,
      };

      expect(() =>
        service.checkTeamCaptainOrTournamentCreatorOrAdmin('u1', 'u2', user),
      ).not.toThrow();
    });

    it('throws when no permission', () => {
      const user: JwtPayload = {
        userId: 'u4',
        email: 'u4@example.com',
        role: Role.USER,
      };

      expect(() =>
        service.checkTeamCaptainOrTournamentCreatorOrAdmin('u1', 'u2', user),
      ).toThrow(
        new ForbiddenException(
          'Цю дію може виконати лише капітан команди, організатор турніру або адміністратор',
        ),
      );
    });
  });
});
