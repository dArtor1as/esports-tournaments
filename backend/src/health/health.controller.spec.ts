import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: { $queryRaw: jest.Mock };
  let cacheManagerMock: { get: jest.Mock };

  beforeEach(async () => {
    prismaMock = { $queryRaw: jest.fn() };
    cacheManagerMock = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('повертає статус ok, якщо БД та Redis відповідають', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);
    cacheManagerMock.get.mockResolvedValueOnce('ok');

    const result = await controller.checkHealth();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.redis).toBe('connected');
    expect(result).toHaveProperty('timestamp');
  });

  it("викидає ServiceUnavailableException (об'єкт Error), якщо є помилка БД", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('DB Failed'));

    await expect(controller.checkHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("викидає ServiceUnavailableException (не Error об'єкт) коректно", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce('Звичайна рядкова помилка');

    try {
      await controller.checkHealth();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const exception = error as ServiceUnavailableException;
      const response = exception.getResponse() as Record<string, unknown>;
      expect(response.details).toBe('Звичайна рядкова помилка');
    }
  });

  it('відпрацьовує таймаут, якщо сервіси зависли', async () => {
    jest.useFakeTimers();

    cacheManagerMock.get.mockImplementationOnce(() => {
      // Повертаємо Promise, який ніколи не вирішується.
      return new Promise(() => {});
    });
    prismaMock.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

    const checkPromise = controller.checkHealth();

    // Просуваємо час, щоб спрацював внутрішній таймаут контролера (3 секунди)
    jest.advanceTimersByTime(3500);

    await expect(checkPromise).rejects.toThrow(ServiceUnavailableException);

    jest.useRealTimers();
  });
});
