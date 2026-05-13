import { Module } from '@nestjs/common';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { TournamentInvitationsController } from './tournament-invitations.controller';
import { MailModule } from 'src/mail/mail.module';
import { RolesGuard } from 'src/auth/roles.guard';
import { InvitationPolicyService } from './invitation-policy.service';

@Module({
  imports: [MailModule],
  controllers: [TournamentInvitationsController],
  providers: [
    TournamentInvitationsService,
    RolesGuard,
    InvitationPolicyService,
  ],
})
export class TournamentInvitationsModule {}
