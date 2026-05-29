import { Module } from '@nestjs/common';
import { TeamInvitationsService } from './team-invitations.service';
import { TeamInvitationsController } from './team-invitations.controller';
import { MailModule } from 'src/mail/mail.module';
import { RolesGuard } from 'src/auth/roles.guard';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { TeamsModule } from 'src/teams/teams.module';
import { TeamInvitationsLogic } from './team-invitations.logic';
import { TeamInvitationsQueryService } from './team-invitations-query.service';

@Module({
  imports: [MailModule, TeamsModule],
  controllers: [TeamInvitationsController],
  providers: [
    TeamInvitationsService,
    RolesGuard,
    AccessPolicyService,
    TeamInvitationsLogic,
    TeamInvitationsQueryService,
  ],
})
export class TeamInvitationsModule {}
