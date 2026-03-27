import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class GenerateBracketDto {
  @ApiProperty({
    description: 'ID турніру, для якого генеруємо сітку Single Elimination',
  })
  @IsUUID()
  @IsNotEmpty()
  tournamentId: string;
}
