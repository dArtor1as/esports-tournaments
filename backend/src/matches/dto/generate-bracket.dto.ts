import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class GenerateBracketDto {
  @ApiProperty({
    description: 'ID турніру, для якого генеруємо сітку Single Elimination',
  })
  @IsUUID()
  @IsNotEmpty()
  tournamentId: string;

  @ApiProperty({
    required: false,
    example: 16,
    description:
      'Опціонально: скільки команд брати в посів (беруться top-N за seed)',
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(32)
  teamCount?: number;

  @ApiProperty({
    required: false,
    example: 4,
    description: 'Опціонально: кількість груп для Group Stage',
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(16)
  groupCount?: number;
}
