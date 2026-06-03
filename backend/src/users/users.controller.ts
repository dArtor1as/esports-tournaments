import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Users (Користувачі)') // Групування у Swagger
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Створити нового користувача' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Отримати список всіх користувачів' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Отримати профіль поточного користувача' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати користувача за ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard) // Тут RolesGuard не потрібен, пускаємо всіх залогінених
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Оновити інформацію про користувача (тільки свій профіль або Адмін)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Post(':id/delete-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Запросити код для видалення акаунту' })
  requestDeletionCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.requestDeletionCode(id, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Анонімізувати користувача та всі його профілі (Soft Delete)',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('code') code?: string,
  ) {
    return this.usersService.remove(id, user, code);
  }
}
