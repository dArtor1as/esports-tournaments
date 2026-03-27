import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTournamentInvitationDto {
  @ApiProperty({ description: 'ID турніру, на який запрошують' })
  @IsUUID()
  @IsNotEmpty()
  tournamentId: string;

  @ApiProperty({ description: 'ID команди, яку запрошують' })
  @IsUUID()
  @IsNotEmpty()
  teamId: string;
}
