import { Module } from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { GeneticSimulatorController } from './genetic-simulator.controller';

@Module({
  controllers: [GeneticSimulatorController],
  providers: [GeneticSimulatorService],
})
export class GeneticSimulatorModule {}
