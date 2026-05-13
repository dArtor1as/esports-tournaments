import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ForfeitMatchDto {
  @ApiPropertyOptional({
    description:
      "ID команди, якій зараховується технічна поразка (Обов'язково для Адмінів/Організаторів)",
  })
  @IsOptional()
  @IsUUID()
  forfeitingTeamId?: string;
}
