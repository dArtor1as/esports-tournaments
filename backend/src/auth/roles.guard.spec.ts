import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '@prisma/client';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    // Безпечно мокаємо Reflector
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  // Строго типізуємо параметр user замість any
  const mockExecutionContext = (
    user?: Partial<JwtPayload>,
  ): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('повертає true, якщо ролі не вимагаються (@Roles відсутній)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = mockExecutionContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it("викидає ForbiddenException, якщо немає об'єкта user (не залогінений)", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = mockExecutionContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('викидає ForbiddenException, якщо роль юзера не збігається', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = mockExecutionContext({ role: Role.USER });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('повертає true, якщо роль юзера є в списку дозволених', () => {
    // Використовуємо реальні ролі з Prisma: ADMIN та USER
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.USER]);
    const context = mockExecutionContext({ role: Role.USER });

    expect(guard.canActivate(context)).toBe(true);
  });
});
