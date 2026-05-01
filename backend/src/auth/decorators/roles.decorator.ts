import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// Зберігаємо передані ролі в метадані маршруту
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
