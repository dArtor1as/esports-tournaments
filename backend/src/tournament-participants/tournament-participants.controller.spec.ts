import { Test, TestingModule } from '@nestjs/testing';
import { TournamentParticipantsController } from './tournament-participants.controller';
import { TournamentParticipantsService } from './tournament-participants.service';

describe('TournamentParticipantsController', () => {
  let controller: TournamentParticipantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentParticipantsController],
      providers: [TournamentParticipantsService],
    }).compile();

    controller = module.get<TournamentParticipantsController>(TournamentParticipantsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
