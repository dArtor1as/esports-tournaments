import { Injectable, NotImplementedException } from '@nestjs/common';
import { Cs2SimulatorService } from './simulators/cs2-simulator.service';
import { IMatchSimulator } from './match-simulator.interface';
import { Dota2SimulatorService } from './simulators/dota2-simulator.service';

@Injectable()
export class SimulatorFactoryService {
  // Використовуємо Map як реєстр стратегій для легкого додавання нових симуляторів у майбутньому
  private readonly simulators = new Map<string, IMatchSimulator>();

  constructor(
    private readonly cs2Simulator: Cs2SimulatorService,
    private readonly dota2Simulator: Dota2SimulatorService,
  ) {
    // Реєструємо симулятори при ініціалізації сервісу
    this.simulators.set('cs2', this.cs2Simulator);
    this.simulators.set('dota2', this.dota2Simulator);
  }

  getSimulator(gameSlug: string): IMatchSimulator {
    const simulator = this.simulators.get(gameSlug.toLowerCase());

    if (!simulator) {
      throw new NotImplementedException(
        `Симулятор для дисципліни '${gameSlug}' ще не реалізовано`,
      );
    }

    return simulator;
  }
}
