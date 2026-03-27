import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsUUID, Max, Min } from 'class-validator';

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
  @Max(1000)
  populations: number;
}
