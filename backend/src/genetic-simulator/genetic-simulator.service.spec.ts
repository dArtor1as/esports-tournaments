import { Test, TestingModule } from '@nestjs/testing';
import { GeneticSimulatorService } from './genetic-simulator.service';

describe('GeneticSimulatorService', () => {
  let service: GeneticSimulatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeneticSimulatorService],
    }).compile();

    service = module.get<GeneticSimulatorService>(GeneticSimulatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
