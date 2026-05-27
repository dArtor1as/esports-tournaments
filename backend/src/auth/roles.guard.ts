import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Читаємо ролі, які ми повісили на ендпоінт через @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Якщо ролі не вказані, пускаємо всіх залогінених
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    // Якщо юзера немає або його роль не в списку дозволених — відмова
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'У вас недостатньо прав (потрібна інша роль)',
      );
    }

    return true;
  }
}
