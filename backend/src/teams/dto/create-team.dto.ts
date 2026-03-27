import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Region } from '@prisma/client';

export class CreateTeamDto {
  @ApiPropertyOptional({ enum: Region, default: Region.GLOBAL })
  @IsEnum(Region)
  @IsOptional()
  region?: Region;

  @ApiProperty({ example: 'Natus Vincere', description: 'Повна назва команди' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'NAVI', description: 'Тег команди (до 6 символів)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(6, { message: 'Тег не може бути довшим за 6 символів' })
  tag: string;

  @ApiProperty({
    example: 'вставте-id-вашого-player-тут',
    description: 'ID ігрового профілю (Player), який стає капітаном',
  })
  @IsUUID()
  @IsNotEmpty()
  captainPlayerId: string;
}
