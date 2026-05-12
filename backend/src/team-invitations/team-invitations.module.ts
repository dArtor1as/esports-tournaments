import { Module } from '@nestjs/common';
import { TeamInvitationsService } from './team-invitations.service';
import { TeamInvitationsController } from './team-invitations.controller';
import { MailModule } from 'src/mail/mail.module';
import { TeamsService } from 'src/teams/teams.service';
import { RolesGuard } from 'src/auth/roles.guard';

@Module({
  imports: [MailModule],
  controllers: [TeamInvitationsController],
  providers: [TeamInvitationsService, TeamsService, RolesGuard],
})
export class TeamInvitationsModule {}
