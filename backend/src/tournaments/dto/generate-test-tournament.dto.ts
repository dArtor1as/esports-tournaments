import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsEnum } from 'class-validator';
import { BracketType } from './create-tournament.dto';

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
  title?: string;
}
