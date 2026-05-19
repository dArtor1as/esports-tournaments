import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { BracketType } from './create-tournament.dto';
import { Region } from '@prisma/client';

export class GenerateTestTournamentDto {
  @ApiPropertyOptional({
    example: 16,
    description:
      'Кількість випадкових команд для створення турніру (з тих, що є в базі)',
    enum: [4, 8, 16, 32],
  })
  @IsOptional()
  @IsInt()
  @IsIn([4, 8, 16, 32])
  teamCount?: number;

  @ApiPropertyOptional({
    example: BracketType.DOUBLE_ELIMINATION,
    description: 'Формат сітки турніру',
    enum: BracketType,
  })
  @IsOptional()
  @IsEnum(BracketType)
  bracketType?: BracketType = BracketType.SINGLE_ELIMINATION;

  @ApiPropertyOptional({
    example: 'Турнір від користувача',
    description: 'Кастомна назва турніру',
  })
  @IsOptional()
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: Region, default: Region.GLOBAL })
  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @ApiPropertyOptional({ example: 3, description: 'Тір турніру (1, 2, 3)' })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  tier?: number;

  @ApiPropertyOptional({ description: 'ID гри' })
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @ApiPropertyOptional({ description: 'Кількість груп (для Round Robin)' })
  @IsOptional()
  @IsInt()
  groupCount?: number;

  @ApiProperty({
    example: true,
    description: 'Чи турнір публічний',
  })
  @IsBoolean()
  @IsNotEmpty()
  isPublic: boolean;
}
