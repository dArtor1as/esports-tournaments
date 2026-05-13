import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Min,
  Max,
  IsInt,
  IsOptional,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  IsEnum,
  Validate,
} from 'class-validator';
import { GameSlug } from '../player.enums';
import { isRoleAllowedForGame, ROLES_BY_GAME } from '../players-role.policy';

@ValidatorConstraint({ name: 'isRoleValidForGame', async: false })
export class IsRoleValidForGameConstraint implements ValidatorConstraintInterface {
  validate(role: string, args: ValidationArguments) {
    const dto = args.object as CreatePlayerDto;
    return isRoleAllowedForGame(dto.gameSlug, role);
  }
  defaultMessage(args: ValidationArguments) {
    const dto = args.object as CreatePlayerDto;
    const allowed = ROLES_BY_GAME[dto.gameSlug] ?? [];
    return `Для гри ${dto.gameSlug} доступні ролі: ${allowed.join(', ')}`;
  }
}

export class CreatePlayerDto {
  @ApiProperty({
    enum: GameSlug,
    description: 'Код дисципліни (наприклад, cs2)',
  })
  @IsEnum(GameSlug)
  @IsNotEmpty()
  gameSlug: GameSlug;

  @ApiProperty({
    example: 'NAVI | dArtor1as', // приклад нікнейму
    description: 'Ігровий нікнейм',
  })
  @IsString()
  @IsNotEmpty()
  nickname: string;

  @ApiPropertyOptional({
    description:
      'Для генерації тестових даних: бажаний тір гравця (1, 2 або 3)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  expectedTier?: number;

  @ApiPropertyOptional({
    description: 'Внутрішньоігрова роль (залежить від гри)',
    example: 'SNIPER',
  })
  @IsOptional()
  @IsString()
  @Validate(IsRoleValidForGameConstraint)
  inGameRole?: string;
}
