import { Test, TestingModule } from '@nestjs/testing';
import { TeamInvitationsController } from './team-invitations.controller';
import { TeamInvitationsService } from './team-invitations.service';

describe('TeamInvitationsController', () => {
  let controller: TeamInvitationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamInvitationsController],
      providers: [TeamInvitationsService],
    }).compile();

    controller = module.get<TeamInvitationsController>(
      TeamInvitationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
