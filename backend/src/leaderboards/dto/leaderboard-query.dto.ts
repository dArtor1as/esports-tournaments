import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Region } from '@prisma/client';
import { PaginationQueryDto } from 'common/dto/pagination-query.dto';

export class LeaderboardQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Region, description: 'Фільтр за регіоном' })
  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @ApiPropertyOptional({ description: 'Фільтр за грою (slug, напр. cs2)' })
  @IsOptional()
  @IsString()
  gameSlug?: string;
}
