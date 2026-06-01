import { toPrismaJson } from './prisma.utils';

describe('PrismaUtils', () => {
  describe('toPrismaJson', () => {
    it("повертає той самий об'єкт, приведений до потрібного типу", () => {
      const testData = { key: 'value', nested: { array: [1, 2, 3] } };

      const result = toPrismaJson(testData);

      // Логіка утиліти — це просто Type Casting,
      // тому значення має залишитися незмінним.
      expect(result).toEqual(testData);
    });

    it('коректно обробляє null та примітиви', () => {
      expect(toPrismaJson(null)).toBeNull();
      expect(toPrismaJson('string_value')).toBe('string_value');
      expect(toPrismaJson(12345)).toBe(12345);
    });
  });
});
