import { PartialType } from '@nestjs/swagger';
import { CreateTournamentParticipantDto } from './create-tournament-participant.dto';

export class UpdateTournamentParticipantDto extends PartialType(
  CreateTournamentParticipantDto,
) {}
