import { PartialType } from '@nestjs/swagger';
import { CreateTournamentInvitationDto } from './create-tournament-invitation.dto';

export class UpdateTournamentInvitationDto extends PartialType(
  CreateTournamentInvitationDto,
) {}
