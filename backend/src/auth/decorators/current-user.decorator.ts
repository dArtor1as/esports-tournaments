import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

// Цей декоратор витягує розшифровані дані юзера з об'єкта запиту
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    return request.user as JwtPayload;
  },
);
