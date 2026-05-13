import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReportScoreDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  scoreA: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  scoreB: number;
}

export class DisputeMatchDto {
  @ApiPropertyOptional({ description: 'Причина, чому рахунок неправильний' })
  @IsOptional()
  @IsString()
  reason?: string;
}
