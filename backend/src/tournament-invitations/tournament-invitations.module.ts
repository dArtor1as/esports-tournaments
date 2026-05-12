import { Module } from '@nestjs/common';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { TournamentInvitationsController } from './tournament-invitations.controller';
import { MailModule } from 'src/mail/mail.module';
import { RolesGuard } from 'src/auth/roles.guard';

@Module({
  imports: [MailModule],
  controllers: [TournamentInvitationsController],
  providers: [TournamentInvitationsService, RolesGuard],
})
export class TournamentInvitationsModule {}
