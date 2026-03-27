import { Test, TestingModule } from '@nestjs/testing';
import { TeamInvitationsService } from './team-invitations.service';

describe('TeamInvitationsService', () => {
  let service: TeamInvitationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeamInvitationsService],
    }).compile();

    service = module.get<TeamInvitationsService>(TeamInvitationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
