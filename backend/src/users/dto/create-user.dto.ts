import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  MinLength,
  IsString,
  IsOptional,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'dartor1as', description: 'Унікальний логін' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'admin@esports.com',
    description: 'Email користувача',
  })
  @IsEmail({}, { message: 'Некоректний формат email' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Мінімум 6 символів' })
  @IsNotEmpty()
  @MinLength(6, { message: 'Пароль має містити щонайменше 6 символів' })
  password: string;

  @ApiPropertyOptional({ enum: Role, default: Role.USER, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
