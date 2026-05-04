import { Test, TestingModule } from '@nestjs/testing';
import { TournamentInvitationsController } from './tournament-invitations.controller';
import { TournamentInvitationsService } from './tournament-invitations.service';

describe('TournamentInvitationsController', () => {
  let controller: TournamentInvitationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentInvitationsController],
      providers: [TournamentInvitationsService],
    }).compile();

    controller = module.get<TournamentInvitationsController>(
      TournamentInvitationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
