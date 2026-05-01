import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AcceptTeamInvitationDto {
  @ApiProperty({
    description: 'ID ігрового профілю (Player), який вступає в команду',
  })
  @IsUUID()
  @IsNotEmpty()
  playerId: string;
}
