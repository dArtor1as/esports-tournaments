import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export class GenerateTestTournamentDto {
  @ApiPropertyOptional({
    example: 16,
    description: 'Кількість випадкових команд для тестового турніру',
    enum: [8, 16, 32],
  })
  @IsOptional()
  @IsInt()
  @IsIn([8, 16, 32])
  teamCount?: number;
}
