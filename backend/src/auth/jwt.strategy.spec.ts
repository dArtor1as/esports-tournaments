import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { Role } from '@prisma/client';

describe('JwtStrategy', () => {
  let configServiceMock: { get: jest.Mock };

  beforeEach(() => {
    configServiceMock = {
      get: jest.fn(),
    };
  });

  it('успішно ініціалізується, якщо є JWT_SECRET', () => {
    configServiceMock.get.mockReturnValue('super-secret-key');

    // Якщо секрет є, створення екземпляра не повинно викидати помилку
    const strategy = new JwtStrategy(
      configServiceMock as unknown as ConfigService,
    );
    expect(strategy).toBeDefined();
  });

  it('викидає Error, якщо JWT_SECRET відсутній в .env', () => {
    configServiceMock.get.mockReturnValue(undefined); // Секрету немає

    expect(
      () => new JwtStrategy(configServiceMock as unknown as ConfigService),
    ).toThrow('КРИТИЧНА ПОМИЛКА: JWT_SECRET відсутній в .env');
  });

  it('коректно мапить JwtTokenPayload у JwtPayload (validate)', () => {
    configServiceMock.get.mockReturnValue('super-secret-key');
    const strategy = new JwtStrategy(
      configServiceMock as unknown as ConfigService,
    );

    const payload = {
      sub: 'user-123',
      email: 'test@gmail.com',
      role: Role.ADMIN,
      iat: 123456789,
      exp: 987654321,
    };

    const result = strategy.validate(payload);

    // Перевіряємо, що sub перетворився на userId, а зайві поля відкинулись
    expect(result).toEqual({
      userId: 'user-123',
      email: 'test@gmail.com',
      role: Role.ADMIN,
    });
  });
});
