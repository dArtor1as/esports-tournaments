import { Module } from '@nestjs/common';
import { TournamentParticipantsService } from './tournament-participants.service';
import { TournamentParticipantsController } from './tournament-participants.controller';

@Module({
  controllers: [TournamentParticipantsController],
  providers: [TournamentParticipantsService],
})
export class TournamentParticipantsModule {}
