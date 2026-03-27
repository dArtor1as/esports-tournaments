import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AcceptTournamentInvitationDto {
  @ApiProperty({
    description: 'Масив ID гравців команди, які гратимуть на цьому турнірі',
    example: ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4', 'uuid-5'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  rosterPlayerIds: string[];
}
