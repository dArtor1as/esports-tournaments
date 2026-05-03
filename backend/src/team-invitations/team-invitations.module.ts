import { Module } from '@nestjs/common';
import { TeamInvitationsService } from './team-invitations.service';
import { TeamInvitationsController } from './team-invitations.controller';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [TeamInvitationsController],
  providers: [TeamInvitationsService],
})
export class TeamInvitationsModule {}
