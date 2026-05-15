import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Region } from '@prisma/client';
import { PaginationQueryDto } from 'common/dto/pagination-query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TournamentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Пошук за назвою турніру (частковий збіг)',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  gameSlug?: string;

  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Рівень турніру (1, 2, 3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tier?: number;
}
