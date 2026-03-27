import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateGameDto {
  @ApiProperty({
    example: 'Counter-Strike 2',
    description: 'Повна назва ігрової дисципліни',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'cs2',
    description:
      'Унікальний ідентифікатор для URL (тільки малі літери та цифри)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug може містити лише малі літери, цифри та дефіси',
  })
  slug: string;
}
