import { Module } from '@nestjs/common';
import { SimulatorFactoryService } from './simulator-factory.service';
import { Cs2SimulatorService } from './simulators/cs2-simulator.service';
import { Dota2SimulatorService } from './simulators/dota2-simulator.service';

@Module({
  providers: [
    SimulatorFactoryService,
    Cs2SimulatorService,
    Dota2SimulatorService,
  ],
  exports: [
    SimulatorFactoryService, // Експортуємо фабрику, щоб інші модулі могли отримувати симулятори
  ],
})
export class MatchSimulatorsModule {}
