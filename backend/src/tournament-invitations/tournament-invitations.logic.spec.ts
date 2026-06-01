import { BadRequestException } from '@nestjs/common';
import { TournamentInvitationsLogic } from './tournament-invitations.logic';
import { AcceptTournamentInvitationDto } from './dto/accept-tournament-invitation.dto';

describe('TournamentInvitationsLogic', () => {
  describe('validateAndFormatRoster', () => {
    const teamPlayers = [
      { id: 'p1' },
      { id: 'p2' },
      { id: 'p3' },
      { id: 'p4' },
      { id: 'p5' },
      { id: 'p6' },
      { id: 'p7' },
    ];

    it('форматує через rosterPlayers', () => {
      const dto = {
        rosterPlayers: [
          { playerId: 'p1', role: 'CAPTAIN' },
          { playerId: 'p2', role: 'PLAYER' },
          { playerId: 'p3', role: 'PLAYER' },
          { playerId: 'p4', role: 'PLAYER' },
          { playerId: 'p5', role: 'PLAYER' },
          { playerId: 'p6', role: 'COACH' },
        ],
      } as unknown as AcceptTournamentInvitationDto;

      const result = TournamentInvitationsLogic.validateAndFormatRoster(
        dto,
        teamPlayers,
        'p1',
      );
      expect(result).toHaveLength(6);
    });

    it('форматує через rosterPlayerIds (fallback)', () => {
      const dto = {
        rosterPlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      } as unknown as AcceptTournamentInvitationDto;

      const result = TournamentInvitationsLogic.validateAndFormatRoster(
        dto,
        teamPlayers,
        'p1',
      );
      expect(result).toHaveLength(5);
      expect(result.find((r) => r.playerId === 'p1')?.role).toBe('CAPTAIN');
      expect(result.find((r) => r.playerId === 'p2')?.role).toBe('PLAYER');
    });

    it('викидає помилку, якщо масиви порожні', () => {
      const dto = {} as AcceptTournamentInvitationDto;
      expect(() =>
        TournamentInvitationsLogic.validateAndFormatRoster(
          dto,
          teamPlayers,
          'p1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо гравець не належить команді', () => {
      const dto = {
        rosterPlayerIds: ['p1', 'p2', 'p3', 'p4', 'FOREIGN_PLAYER'],
      } as unknown as AcceptTournamentInvitationDto;
      expect(() =>
        TournamentInvitationsLogic.validateAndFormatRoster(
          dto,
          teamPlayers,
          'p1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку при наявності дублікатів', () => {
      const dto = {
        rosterPlayerIds: ['p1', 'p2', 'p3', 'p4', 'p1'],
      } as unknown as AcceptTournamentInvitationDto;
      expect(() =>
        TournamentInvitationsLogic.validateAndFormatRoster(
          dto,
          teamPlayers,
          'p1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо активних гравців не 5', () => {
      const dto = {
        rosterPlayerIds: ['p1', 'p2', 'p3', 'p4'],
      } as unknown as AcceptTournamentInvitationDto; // Тільки 4
      expect(() =>
        TournamentInvitationsLogic.validateAndFormatRoster(
          dto,
          teamPlayers,
          'p1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо тренерів більше 1', () => {
      const dto = {
        rosterPlayers: [
          { playerId: 'p1', role: 'CAPTAIN' },
          { playerId: 'p2', role: 'PLAYER' },
          { playerId: 'p3', role: 'PLAYER' },
          { playerId: 'p4', role: 'PLAYER' },
          { playerId: 'p5', role: 'PLAYER' },
          { playerId: 'p6', role: 'COACH' },
          { playerId: 'p7', role: 'COACH' }, // Другий тренер
        ],
      } as unknown as AcceptTournamentInvitationDto;
      expect(() =>
        TournamentInvitationsLogic.validateAndFormatRoster(
          dto,
          teamPlayers,
          'p1',
        ),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо запасних більше 1', () => {
      const dto = {
        rosterPlayers: [
          { playerId: 'p1', role: 'CAPTAIN' },
          { playerId: 'p2', role: 'PLAYER' },
          { playerId: 'p3', role: 'PLAYER' },
          { playerId: 'p4', role: 'PLAYER' },
          { playerId: 'p5', role: 'PLAYER' },
          { playerId: 'p6', role: 'SUBSTITUTE' },
          { playerId: 'p7', role: 'SUBSTITUTE' }, // Другий запасний
        ],
      } as unknown as AcceptTournamentInvitationDto;
      expect(() =>
        TournamentInvitationsLogic.validateAndFormatRoster(
          dto,
          teamPlayers,
          'p1',
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('determineInitialStage', () => {
    it('визначає GROUP для ROUND_ROBIN з обʼєкта', () => {
      expect(
        TournamentInvitationsLogic.determineInitialStage(
          { bracketType: 'ROUND_ROBIN' } as never,
          't',
        ),
      ).toBe('GROUP');
    });

    it('визначає PLAYOFF для інших форматів з обʼєкта', () => {
      expect(
        TournamentInvitationsLogic.determineInitialStage(
          { bracketType: 'SINGLE_ELIMINATION' } as never,
          't',
        ),
      ).toBe('PLAYOFF');
    });

    it('парсить JSON рядок', () => {
      expect(
        TournamentInvitationsLogic.determineInitialStage(
          '{"bracketType":"ROUND_ROBIN"}',
          't',
        ),
      ).toBe('GROUP');
    });

    it('перехоплює помилку парсингу і повертає PLAYOFF за замовчуванням', () => {
      expect(
        TournamentInvitationsLogic.determineInitialStage('INVALID_JSON', 't'),
      ).toBe('PLAYOFF');
    });
    it('повертає PLAYOFF (дефолт), якщо settingsRaw є null або undefined', () => {
      // Покриває рядок 82 (спрацьовує гілка || {})
      expect(
        TournamentInvitationsLogic.determineInitialStage(null as never, 't'),
      ).toBe('PLAYOFF');
    });

    it("обробляє помилки парсингу, якщо викидається не об'єкт Error (наприклад, рядок)", () => {
      const parseSpy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "Це звичайна рядкова помилка, а не об'єкт Error"; // Імітуємо кастомний throw
      });

      expect(
        TournamentInvitationsLogic.determineInitialStage('some string', 't'),
      ).toBe('PLAYOFF');

      parseSpy.mockRestore(); // Обов'язково повертаємо оригінальний JSON.parse
    });
  });
});
