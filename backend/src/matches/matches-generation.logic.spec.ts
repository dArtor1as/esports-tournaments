import { BadRequestException } from '@nestjs/common';
import { MatchesGenerationLogic } from './matches-generation.logic';

describe('MatchesGenerationLogic', () => {
  let logic: MatchesGenerationLogic;

  beforeEach(() => {
    logic = new MatchesGenerationLogic();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses JSON string settings', () => {
    const settings = logic.parseSettings('{"groupCount":4}', 't1');
    expect(settings.groupCount).toBe(4);
  });

  it('returns settings object as-is', () => {
    const settings = { bracketType: 'DOUBLE_ELIMINATION' };
    expect(logic.parseSettings(settings, 't1')).toEqual(settings);
  });

  it('returns empty settings and logs on invalid JSON', () => {
    const errorSpy = jest.spyOn(
      (
        logic as unknown as {
          logger: { error: (message: string) => void };
        }
      ).logger,
      'error',
    );

    const settings = logic.parseSettings('{invalid', 't1');

    expect(settings).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
  });

  describe('validatePlayoffGeneration', () => {
    it('throws when tournament is finished', () => {
      expect(() =>
        logic.validatePlayoffGeneration('finished', 0, undefined, 8),
      ).toThrow(new BadRequestException('Турнір вже завершено'));
    });

    it('throws when playoff matches already exist', () => {
      expect(() =>
        logic.validatePlayoffGeneration('live', 1, undefined, 8),
      ).toThrow(new BadRequestException('Сітка плей-оф вже згенерована'));
    });

    it('throws when requested team count exceeds participants', () => {
      expect(() => logic.validatePlayoffGeneration('live', 0, 16, 8)).toThrow(
        new BadRequestException('Недостатньо учасників. Зареєстровано: 8.'),
      );
    });

    it('throws when team count is not power of two', () => {
      expect(() => logic.validatePlayoffGeneration('live', 0, 6, 6)).toThrow(
        new BadRequestException(
          'Кількість команд має бути 4, 8, 16, 32 тощо. Зараз: 6',
        ),
      );
    });

    it('returns resolved team count', () => {
      expect(logic.validatePlayoffGeneration('live', 0, undefined, 8)).toBe(8);
    });
  });

  describe('validateGroupGeneration', () => {
    it('throws when tournament status is not planned', () => {
      expect(() =>
        logic.validateGroupGeneration('live', 0, 8, 8, 2, 2),
      ).toThrow(
        new BadRequestException('Групи вже згенеровані або турнір завершено'),
      );
    });

    it('throws when group matches already exist', () => {
      expect(() =>
        logic.validateGroupGeneration('planned', 1, 8, 8, 2, 2),
      ).toThrow(new BadRequestException('Груповий етап вже згенеровано'));
    });

    it('throws when team count is less than 4', () => {
      expect(() =>
        logic.validateGroupGeneration('planned', 0, 2, 2, 2, 2),
      ).toThrow(
        new BadRequestException(
          'Для групового етапу потрібно мінімум 4 команди',
        ),
      );
    });

    it('throws when grouping is invalid', () => {
      expect(() =>
        logic.validateGroupGeneration('planned', 0, 6, 6, 4, undefined),
      ).toThrow(BadRequestException);
    });

    it('returns effective group count', () => {
      const result = logic.validateGroupGeneration(
        'planned',
        0,
        8,
        8,
        undefined,
        4,
      );
      expect(result).toEqual({ teamCount: 8, effectiveGroupCount: 4 });
    });
  });
});
