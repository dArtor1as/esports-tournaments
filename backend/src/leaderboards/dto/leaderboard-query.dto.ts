import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Region } from '@prisma/client';
import { PaginationQueryDto } from 'common/dto/pagination-query.dto';

export class LeaderboardQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Region, description: 'Фільтр за регіоном' })
  @IsOptional()
  @IsEnum(Region)
  region?: Region;
}
