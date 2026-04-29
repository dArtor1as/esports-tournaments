import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

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
    example: 'DOUBLE_ELIMINATION',
    description: 'Формат сітки. SINGLE_ELIMINATION або DOUBLE_ELIMINATION',
    enum: ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION'])
  bracketType?: string;

  @ApiPropertyOptional({
    example: 'Турнір від користувача',
    description: 'Кастомна назва турніру',
  })
  @IsOptional()
  @IsString()
  title?: string;
}
