import { Test, TestingModule } from '@nestjs/testing';
import { TournamentParticipantsService } from './tournament-participants.service';

describe('TournamentParticipantsService', () => {
  let service: TournamentParticipantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TournamentParticipantsService],
    }).compile();

    service = module.get<TournamentParticipantsService>(
      TournamentParticipantsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
