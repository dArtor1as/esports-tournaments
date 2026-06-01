import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

// 1. Створюємо строгий тип для фабрики декоратора
type DecoratorFactory = (
  data: unknown,
  context: ExecutionContext,
) => JwtPayload | undefined;

// 2. Строго типізуємо структуру метаданих NestJS
interface NestRouteArgs {
  [key: string]: {
    factory: DecoratorFactory;
  };
}

// 3. Звертаємося прямо до @CurrentUser()
function getParamDecoratorFactory(): DecoratorFactory {
  class Test {
    public test(@CurrentUser() _value: unknown) {
      return _value;
    }
  }

  // Безпечно кастуємо метадані через unknown до нашого інтерфейсу
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Test,
    'test',
  ) as unknown as NestRouteArgs;
  const key = Object.keys(args)[0];
  return args[key].factory;
}

describe('CurrentUser Decorator', () => {
  it("повертає об'єкт user з request", () => {
    const factory = getParamDecoratorFactory();

    const mockUser: Partial<JwtPayload> = {
      userId: '123',
      email: 'test@test.com',
    };

    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(null, mockExecutionContext);

    expect(result).toBe(mockUser);
  });

  it('повертає undefined, якщо user відсутній у request', () => {
    const factory = getParamDecoratorFactory();

    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const result = factory(null, mockExecutionContext);

    expect(result).toBeUndefined();
  });
});
