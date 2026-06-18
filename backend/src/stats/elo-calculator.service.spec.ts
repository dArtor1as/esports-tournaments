import { Test, TestingModule } from '@nestjs/testing';
import { EloCalculatorService } from './elo-calculator.service';

describe('EloCalculatorService', () => {
  let service: EloCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EloCalculatorService],
    }).compile();

    service = module.get<EloCalculatorService>(EloCalculatorService);
  });

  it('повинен бути визначеним', () => {
    expect(service).toBeDefined();
  });

  describe('calculateElo', () => {
    it('використовує baseK = 20 для стадії GROUP', () => {
      const result = service.calculateElo(1000, 1000, true, 1, 'GROUP', 'NONE');
      // При однакових рейтингах очікування = 0.5. change = 20 * 1 * (1 - 0.5) = 10
      expect(result.changeA).toBe(10);
      expect(result.changeB).toBe(-10);
    });

    it('використовує baseK = 32 для плей-оф', () => {
      const result = service.calculateElo(
        1000,
        1000,
        true,
        1,
        'PLAYOFF',
        'UPPER',
      );
      // 32 * 1 * (1 - 0.5) = 16
      expect(result.changeA).toBe(16);
      expect(result.changeB).toBe(-16);
    });

    it('використовує baseK = 40 та додає бонус для Гранд Фіналу', () => {
      // Гранд фінал: baseK = 40. Переможець отримує 40 * 0.5 = 20 + бонус (25 * 1) = 45
      const result = service.calculateElo(
        1000,
        1000,
        true,
        1,
        'PLAYOFF',
        'GRAND_FINAL',
      );
      expect(result.changeA).toBe(45); // ВИПРАВЛЕНО з 50 на 45
      // Програвший: -20 (бонус йому не додається, бо isAWinner = true для A)
      expect(result.changeB).toBe(-20);
    });

    it('нараховує бонус команді B у Гранд Фіналі, якщо вона перемогла (isAWinner = false)', () => {
      const result = service.calculateElo(
        1000,
        1000,
        false, // Перемагає команда B
        1,
        'PLAYOFF',
        'GRAND_FINAL',
      );
      // Команда B отримує базові 20 + бонус 25 = 45
      expect(result.changeB).toBe(45); // ВИПРАВЛЕНО з 50 на 45
      expect(result.changeA).toBe(-20);
    });

    it('зменшує baseK до 16, якщо ratingB > 3000 (а ratingA < 3000)', () => {
      const result = service.calculateElo(
        2800,
        3100, // Рейтинг B вищий за ліміт
        false,
        1,
        'PLAYOFF',
        'UPPER',
      );
      // baseK = 16. Тепер ймовірність перемоги B близько 80%
      // Зміна буде приблизно 16 * (1 - 0.8) = 3 (більше нуля)
      expect(result.changeB).toBeGreaterThan(0);
      expect(result.changeB).toBeLessThanOrEqual(16); // baseK = 16
    });

    it('зменшує baseK до 16 для гравців з рейтингом > 3000', () => {
      const result = service.calculateElo(
        3100,
        2000,
        true,
        1,
        'PLAYOFF',
        'UPPER',
      );
      // baseK = 16. Рейтинг 3100 значно вищий за 2000, тому expectedA майже 1.
      // Зміна буде дуже малою
      expect(result.changeA).toBeLessThan(16);
      expect(result.changeB).toBeGreaterThan(-16);
    });

    it('коректно враховує kFactor з налаштувань турніру', () => {
      const resultNormal = service.calculateElo(
        1000,
        1000,
        true,
        1,
        'GROUP',
        'NONE',
      ); // 10
      const resultBoosted = service.calculateElo(
        1000,
        1000,
        true,
        2,
        'GROUP',
        'NONE',
      ); // 20

      expect(resultBoosted.changeA).toBe(resultNormal.changeA * 2);
    });
  });
});
