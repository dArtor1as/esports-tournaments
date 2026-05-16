import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateTeamInvitationDto {
  @ApiProperty({ description: 'ID команди, куди запрошують' })
  @IsUUID()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({
    description: 'Нікнейм гравця, якого запрошують',
  })
  @IsString()
  @IsNotEmpty()
  playerNickname: string;
}
