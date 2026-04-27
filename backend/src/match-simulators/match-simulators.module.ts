import { Module } from '@nestjs/common';
import { SimulatorFactoryService } from './simulator-factory.service';
import { Cs2SimulatorService } from './cs2-simulator.service';

@Module({
  providers: [SimulatorFactoryService, Cs2SimulatorService],
  exports: [
    SimulatorFactoryService, // Експортуємо фабрику, щоб інші модулі могли отримувати симулятори
  ],
})
export class MatchSimulatorsModule {}
