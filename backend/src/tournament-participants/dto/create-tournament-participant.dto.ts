import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Stage } from '@prisma/client';

export class CreateTournamentParticipantDto {
  @ApiProperty({ description: 'ID турніру' })
  @IsUUID()
  @IsNotEmpty()
  tournamentId: string;

  @ApiProperty({ description: 'ID команди, яка реєструється' })
  @IsUUID()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({
    description: 'Масив ID гравців команди, які заявлені на цей турнір',
    example: ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4', 'uuid-5'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1) // Мінімум 1 (для соло турнірів)
  @ArrayMaxSize(7) // Максимум 7 (5 основи + 2 заміна/тренер для командних)
  rosterPlayerIds: string[];
}
