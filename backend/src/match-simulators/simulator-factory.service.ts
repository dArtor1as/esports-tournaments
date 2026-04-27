import { Injectable, NotImplementedException } from '@nestjs/common';
import { Cs2SimulatorService } from './cs2-simulator.service';
import { IMatchSimulator } from './match-simulator.interface';

@Injectable()
export class SimulatorFactoryService {
  constructor(
    // передаємо наші доступні симулятори
    private readonly cs2Simulator: Cs2SimulatorService,
  ) {}

  // Головний метод фабрики
  getSimulator(gameSlug: string): IMatchSimulator {
    switch (gameSlug.toLowerCase()) {
      case 'cs2':
        return this.cs2Simulator;
      default:
        throw new NotImplementedException(
          `Симулятор для дисципліни '${gameSlug}' ще не реалізовано`,
        );
    }
  }
}
