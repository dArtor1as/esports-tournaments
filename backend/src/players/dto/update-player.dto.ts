import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { ROLES_BY_GAME } from '../players-role.policy';

// Збираємо всі ролі для базової валідації "чи взагалі така роль існує"
const ALL_ROLES = Object.values(ROLES_BY_GAME).flat();

export class UpdatePlayerDto {
  @ApiPropertyOptional({ example: 'NewNickname' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nickname?: string;

  @ApiPropertyOptional({
    description: 'Внутрішньоігрова роль (має відповідати грі профілю)',
    enum: ALL_ROLES,
  })
  @IsOptional()
  @IsString()
  @IsIn(ALL_ROLES) // Базова перевірка
  inGameRole?: string;
}
