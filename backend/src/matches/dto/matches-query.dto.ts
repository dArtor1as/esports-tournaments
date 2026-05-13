import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Stage } from '@prisma/client';

export class MatchesQueryDto {
  @ApiPropertyOptional({
    enum: Stage,
    description: 'Фільтр за стадією турніру',
  })
  @IsOptional()
  @IsEnum(Stage)
  stage?: Stage;
}
