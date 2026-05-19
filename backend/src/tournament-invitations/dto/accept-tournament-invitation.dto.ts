import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
export class RosterPlayerDto {
  @ApiProperty({ description: 'ID гравця' })
  @IsUUID()
  @IsNotEmpty()
  playerId: string;

  @ApiProperty({
    description: 'Роль у ростері на турнір',
    enum: ['PLAYER', 'COACH', 'SUBSTITUTE', 'CAPTAIN'],
  })
  @IsEnum(['PLAYER', 'COACH', 'SUBSTITUTE', 'CAPTAIN'])
  @IsNotEmpty()
  role: string;
}
export class AcceptTournamentInvitationDto {
  @ApiProperty({
    description: 'Масив ID гравців команди, які гратимуть на цьому турнірі',
    example: ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4', 'uuid-5'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  rosterPlayerIds: string[];

  @ApiPropertyOptional({
    description: "Масив об'єктів із зазначенням ролей гравців",
    type: [RosterPlayerDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RosterPlayerDto)
  rosterPlayers?: RosterPlayerDto[];
}
