import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Region, TournamentFormat } from '@prisma/client';

export class CreateTournamentDto {
  @ApiProperty({ example: 'IEM Katowice 2026', description: 'Назва турніру' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'ID гри (наприклад, CS2)' })
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({
    example: 1,
    description: 'Тір турніру (1 - Pro, 2 - Semi-pro, 3 - Amateur)',
  })
  @IsInt()
  @Min(1)
  tier: number;

  @ApiProperty({ enum: Region, default: Region.GLOBAL })
  @IsEnum(Region)
  region: Region;

  @ApiProperty({
    example: 1.0,
    description: 'Коефіцієнт важливості для розрахунку Elo (k-factor)',
  })
  @IsNumber()
  kFactor: number;

  @ApiPropertyOptional({
    enum: TournamentFormat,
    default: TournamentFormat.TEAM,
  })
  @IsEnum(TournamentFormat)
  @IsOptional()
  format?: TournamentFormat;

  @ApiPropertyOptional({
    example: 16,
    description: 'Максимальна кількість учасників',
  })
  @IsInt()
  @Min(2)
  @IsOptional()
  maxParticipants?: number;

  @ApiProperty({
    example: {
      pointsForWin: 3,
      tiebreaker: 'h2h',
      bracketType: 'DOUBLE_ELIMINATION',
    },
    description:
      'Гнучкі налаштування турніру (bracketType: SINGLE_ELIMINATION або DOUBLE_ELIMINATION)',
  })
  @IsObject()
  settings: Record<string, any>;

  @ApiProperty({
    example: true,
    description: 'Чи турнір публічний',
  })
  @IsBoolean()
  @IsNotEmpty()
  isPublic: boolean;
}
