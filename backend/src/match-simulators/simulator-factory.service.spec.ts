import { Test, TestingModule } from '@nestjs/testing';
import { SimulatorFactoryService } from './simulator-factory.service';

describe('SimulatorFactoryService', () => {
  let service: SimulatorFactoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SimulatorFactoryService],
    }).compile();

    service = module.get<SimulatorFactoryService>(SimulatorFactoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
