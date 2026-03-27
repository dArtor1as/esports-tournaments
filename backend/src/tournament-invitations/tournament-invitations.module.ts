import { Module } from '@nestjs/common';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { TournamentInvitationsController } from './tournament-invitations.controller';

@Module({
  controllers: [TournamentInvitationsController],
  providers: [TournamentInvitationsService],
})
export class TournamentInvitationsModule {}
