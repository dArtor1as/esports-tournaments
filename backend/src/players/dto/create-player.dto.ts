import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  Max,
  IsInt,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum Cs2Role {
  SNIPER = 'SNIPER',
  RIFLER = 'RIFLER',
  ENTRY = 'ENTRY',
  SUPPORT = 'SUPPORT',
  IGL = 'IGL',
}

export enum Dota2Role {
  POS_1 = 'POS_1',
  POS_2 = 'POS_2',
  POS_3 = 'POS_3',
  POS_4 = 'POS_4',
  POS_5 = 'POS_5',
}

export class CreatePlayerDto {
  @ApiProperty({
    example: '987fcdeb-51a2-43d7-9012-3456789abcde', // приклад UUID
    description: 'ID дисципліни (гри), наприклад CS2',
  })
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({
    example: 'NAVI | dArtor1as', // приклад нікнейму
    description: 'Ігровий нікнейм',
  })
  @IsString()
  @IsNotEmpty()
  nickname: string;

  @ApiPropertyOptional({
    description:
      'Для генерації тестових даних: бажаний тір гравця (1, 2 або 3)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  expectedTier?: number;

  @IsOptional()
  @IsString()
  inGameRole?: string;
}
