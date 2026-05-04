import { PartialType } from '@nestjs/swagger';
import { CreateTeamInvitationDto } from './create-team-invitation.dto';

export class UpdateTeamInvitationDto extends PartialType(
  CreateTeamInvitationDto,
) {}
