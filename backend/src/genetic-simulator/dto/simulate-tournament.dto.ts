import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Stage } from '@prisma/client';

export class SimulateTournamentDto {
  @ApiProperty({
    description: 'ID турніру, для якого вже згенерована порожня сітка матчів',
  })
  @IsUUID()
  @IsNotEmpty()
  tournamentId: string;

  @ApiProperty({
    example: 100,
    description: 'Кількість популяцій (симуляцій) для прогону алгоритму',
  })
  @IsInt()
  @Min(10)
  @Max(200)
  populations: number;

  @ApiPropertyOptional({ enum: Stage })
  @IsOptional()
  @IsEnum(Stage)
  stage?: Stage = Stage.PLAYOFF;

  @ApiPropertyOptional({
    description:
      'Якщо true - це аналітичний прогноз. Якщо false - алгоритм перезапише результати матчів у БД (COMMIT).',
  })
  @IsOptional()
  @IsBoolean()
  isDryRun?: boolean = true;

  @ApiPropertyOptional({
    example: 20,
    description:
      'Кількість поколінь (еволюційних циклів). Впливає на глибину пошуку.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25) // Обмежуємо, щоб не покласти сервер
  generations?: number;
}
