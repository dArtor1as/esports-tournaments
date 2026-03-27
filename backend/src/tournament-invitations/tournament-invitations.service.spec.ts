import { Test, TestingModule } from '@nestjs/testing';
import { TournamentInvitationsService } from './tournament-invitations.service';

describe('TournamentInvitationsService', () => {
  let service: TournamentInvitationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TournamentInvitationsService],
    }).compile();

    service = module.get<TournamentInvitationsService>(TournamentInvitationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
