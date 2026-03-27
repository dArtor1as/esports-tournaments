import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTeamInvitationDto {
  @ApiProperty({ description: 'ID команди, куди запрошують' })
  @IsUUID()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({ description: 'ID користувача (User), якого запрошують' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
