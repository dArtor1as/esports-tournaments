import { Module } from '@nestjs/common';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { TournamentInvitationsController } from './tournament-invitations.controller';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [TournamentInvitationsController],
  providers: [TournamentInvitationsService],
})
export class TournamentInvitationsModule {}
