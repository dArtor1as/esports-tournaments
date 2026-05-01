import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Цей декоратор витягує розшифровані дані юзера з об'єкта запиту
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user; // тут буде те, що ми повернули в методі validate ст
  },
);
