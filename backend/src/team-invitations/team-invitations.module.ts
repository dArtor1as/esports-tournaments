import { Module } from '@nestjs/common';
import { TeamInvitationsService } from './team-invitations.service';
import { TeamInvitationsController } from './team-invitations.controller';

@Module({
  controllers: [TeamInvitationsController],
  providers: [TeamInvitationsService],
})
export class TeamInvitationsModule {}
