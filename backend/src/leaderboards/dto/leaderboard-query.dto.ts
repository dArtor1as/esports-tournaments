import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Region } from '@prisma/client';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ description: 'Номер сторінки', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Кількість записів на сторінку',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 100;

  @ApiPropertyOptional({
    enum: Region,
    description: 'Фільтр за регіоном (EU, CIS, NA тощо)',
  })
  @IsOptional()
  @IsEnum(Region)
  region?: Region;
}
