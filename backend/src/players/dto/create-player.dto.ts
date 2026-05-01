import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  Max,
  IsInt,
  IsOptional,
} from 'class-validator';

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
}
