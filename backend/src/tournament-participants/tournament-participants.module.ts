import { Module } from '@nestjs/common';
import { TournamentParticipantsService } from './tournament-participants.service';
import { TournamentParticipantsController } from './tournament-participants.controller';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Module({
  controllers: [TournamentParticipantsController],
  providers: [TournamentParticipantsService, AccessPolicyService],
})
export class TournamentParticipantsModule {}
