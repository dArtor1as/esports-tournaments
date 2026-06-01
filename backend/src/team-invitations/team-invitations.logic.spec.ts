import { BadRequestException } from '@nestjs/common';
import { TeamInvitationsLogic } from './team-invitations.logic';

type ValidateArgs = Parameters<typeof TeamInvitationsLogic.validateAcceptance>;
type InviteInput = ValidateArgs[0];
type PlayerInput = ValidateArgs[1];

describe('TeamInvitationsLogic', () => {
  describe('validateAcceptance', () => {
    const validInvite = {
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 100000),
      userId: 'u1',
      team: { gameId: 'g1' },
    } as unknown as InviteInput;

    const validPlayer = {
      userId: 'u1',
      gameId: 'g1',
      teamId: null,
    } as unknown as PlayerInput;

    it('проходить валідацію з правильними даними', () => {
      expect(() =>
        TeamInvitationsLogic.validateAcceptance(validInvite, validPlayer, 'u1'),
      ).not.toThrow();
    });

    it('викидає помилку, якщо статус не PENDING', () => {
      expect(() =>
        TeamInvitationsLogic.validateAcceptance(
          { ...validInvite, status: 'ACCEPTED' } as unknown as InviteInput,
          validPlayer,
          'u1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо інвайт протерміновано', () => {
      expect(() =>
        TeamInvitationsLogic.validateAcceptance(
          {
            ...validInvite,
            expiresAt: new Date(Date.now() - 1000),
          } as unknown as InviteInput,
          validPlayer,
          'u1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо інвайт для іншого юзера', () => {
      expect(() =>
        TeamInvitationsLogic.validateAcceptance(validInvite, validPlayer, 'u2'),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо гравець з іншої гри', () => {
      expect(() =>
        TeamInvitationsLogic.validateAcceptance(
          validInvite,
          { ...validPlayer, gameId: 'g2' } as unknown as PlayerInput,
          'u1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо гравець вже в команді', () => {
      expect(() =>
        TeamInvitationsLogic.validateAcceptance(
          validInvite,
          { ...validPlayer, teamId: 't1' } as unknown as PlayerInput,
          'u1',
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('determineTeamRole', () => {
    it('повертає COACH, якщо вказано', () => {
      expect(TeamInvitationsLogic.determineTeamRole('COACH', 2, 5)).toBe(
        'COACH',
      );
    });

    it('повертає SUBSTITUTE, якщо основа заповнена', () => {
      expect(TeamInvitationsLogic.determineTeamRole('ENTRY', 5, 5)).toBe(
        'SUBSTITUTE',
      );
    });

    it('повертає PLAYER, якщо в основі є місце', () => {
      expect(TeamInvitationsLogic.determineTeamRole('ENTRY', 4, 5)).toBe(
        'PLAYER',
      );
    });
  });

  describe('calculateTeamRating', () => {
    it('повертає isComplete: false, якщо гравців недостатньо', () => {
      const result = TeamInvitationsLogic.calculateTeamRating(
        [{ rating: 1000, teamRole: 'PLAYER' }],
        1500,
        'PLAYER',
        5,
        1,
      );
      expect(result.isComplete).toBe(false);
    });

    it('рахує новий рейтинг, якщо команда укомплектована гравцем основи', () => {
      const players: { rating: number; teamRole: string | null }[] = Array.from(
        { length: 4 },
        () => ({ rating: 1000, teamRole: 'PLAYER' }),
      );

      const result = TeamInvitationsLogic.calculateTeamRating(
        players,
        2000,
        'PLAYER',
        5,
        4,
      );
      expect(result.isComplete).toBe(true);
      expect(result.newAverageRating).toBe(1200);
    });

    it('ігнорує рейтинг COACH та SUBSTITUTE', () => {
      const players: { rating: number; teamRole: string | null }[] = Array.from(
        { length: 5 },
        () => ({ rating: 1000, teamRole: 'PLAYER' }),
      );

      const result = TeamInvitationsLogic.calculateTeamRating(
        players,
        5000,
        'COACH',
        5,
        5,
      );
      expect(result.isComplete).toBe(true);
      expect(result.newAverageRating).toBe(1000);
    });
  });
});
