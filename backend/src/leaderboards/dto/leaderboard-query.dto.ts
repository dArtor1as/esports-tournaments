import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Region } from '@prisma/client';
import { PaginationQueryDto } from 'common/dto/pagination-query.dto';
import { Transform } from 'class-transformer';

export class LeaderboardQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Region, description: 'Фільтр за регіоном' })
  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @ApiPropertyOptional({ description: 'Фільтр за грою (slug, напр. cs2)' })
  @IsOptional()
  @IsString()
  gameSlug?: string;

  @ApiPropertyOptional({ description: 'Пошук за назвою або тегом команди' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Фільтр за рівнем (Tier)' })
  @IsOptional()
  @Transform(({ value }: { value: string | number }) =>
    parseInt(String(value), 10),
  )
  @IsNumber()
  tier?: number;

  @ApiPropertyOptional({ description: 'Фільтр: true - повні, false - шукають' })
  @IsOptional()
  @IsString() // Приймаємо як рядок "true" або "false" з URL
  isComplete?: string;
}
