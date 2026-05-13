import { Test, TestingModule } from '@nestjs/testing';
import { MatchesController } from './matches.controller';
import { MatchesProgressionService } from './matches-progression.service';
import { MatchesGeneratorService } from './matches-generator.service';
import { MatchesConsensusService } from './matches-consensus.service';

describe('MatchesController', () => {
  let controller: MatchesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        MatchesProgressionService,
        MatchesConsensusService,
        MatchesGeneratorService,
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
