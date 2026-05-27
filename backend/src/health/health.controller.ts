import {
  Controller,
  Get,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health (Перевірка стану)')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Перевірка стану застосунку, БД та Redis' })
  async checkHealth() {
    try {
      // 1. Перевірка БД
      const dbCheck = this.prisma.$queryRaw`SELECT 1`;

      // 2. Перевірка Redis
      const redisCheck = this.cacheManager.get('_health_check');

      // Чекаємо обидві перевірки (з таймаутом у 3 секунди, щоб запит не завис назавжди)
      await Promise.race([
        Promise.all([dbCheck, redisCheck]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 3000),
        ),
      ]);

      return {
        status: 'ok',
        database: 'connected',
        redis: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new ServiceUnavailableException({
        status: 'error',
        message: 'Сервіс недоступний',
        details: errorMessage,
      });
    }
  }
}
