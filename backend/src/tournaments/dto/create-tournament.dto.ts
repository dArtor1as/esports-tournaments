import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Region, TournamentFormat } from '@prisma/client';
import { Type } from 'class-transformer';

export enum BracketType {
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN',
}
export class TournamentSettingsDto {
  @ApiPropertyOptional({
    enum: BracketType,
    default: BracketType.SINGLE_ELIMINATION,
  })
  @IsOptional()
  @IsEnum(BracketType)
  bracketType?: BracketType = BracketType.SINGLE_ELIMINATION;

  @ApiPropertyOptional({ description: 'Очки за перемогу в групі', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pointsPerWin?: number = 3;
}
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
  @IsOptional()
  @IsEnum(Region)
  region?: Region;

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

  @ApiPropertyOptional({ type: () => TournamentSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TournamentSettingsDto)
  settings?: TournamentSettingsDto;

  @ApiProperty({
    example: true,
    description: 'Чи турнір публічний',
  })
  @IsBoolean()
  @IsNotEmpty()
  isPublic: boolean;

  @ApiPropertyOptional({ description: 'Кількість груп (для Round Robin)' })
  @IsOptional()
  @IsInt()
  groupCount?: number;
}
