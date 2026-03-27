import { Test, TestingModule } from '@nestjs/testing';
import { GeneticSimulatorController } from './genetic-simulator.controller';
import { GeneticSimulatorService } from './genetic-simulator.service';

describe('GeneticSimulatorController', () => {
  let controller: GeneticSimulatorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeneticSimulatorController],
      providers: [GeneticSimulatorService],
    }).compile();

    controller = module.get<GeneticSimulatorController>(GeneticSimulatorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
