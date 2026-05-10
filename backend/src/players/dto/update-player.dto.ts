import { PartialType } from '@nestjs/swagger';
import { CreatePlayerDto } from './create-player.dto';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePlayerDto extends PartialType(CreatePlayerDto) {
  @IsOptional()
  @IsString()
  inGameRole?: string;
}
