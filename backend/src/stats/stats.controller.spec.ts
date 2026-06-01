import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('StatsController', () => {
  let controller: StatsController;
  let statsService: MockProxy<StatsService>;

  beforeEach(async () => {
    statsService = mock<StatsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: StatsService, useValue: statsService }],
    }).compile();

    controller = module.get<StatsController>(StatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('processTournamentStats повинен викликати метод сервісу', async () => {
    // Створюємо мок з правильною типізацією
    const mockUser: JwtPayload = {
      userId: 'u1',
      email: 'test@test.com',
      role: Role.USER,
    };

    statsService.processTournamentStats.mockResolvedValueOnce({
      message: 'ok',
      processedMatches: 1,
    });

    const result = await controller.processTournamentStats('t1', mockUser);

    expect(result).toEqual({ message: 'ok', processedMatches: 1 });
    expect(statsService.processTournamentStats.mock.calls[0]).toEqual([
      't1',
      mockUser,
    ]);
  });
});
