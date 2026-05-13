import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Players (Ігрові профілі)') // Назва розділу в Swagger
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Створити ігровий профіль для користувача' })
  create(
    @Body() createPlayerDto: CreatePlayerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.playersService.create(createPlayerDto, user.userId);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('all_players')
  @CacheTTL(30000) // Кешуємо на 30 секунд
  @ApiOperation({
    summary: 'Отримати список всіх гравців (з їхніми іграми та юзерами)',
  })
  findAll() {
    return this.playersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати деталі конкретного гравця за ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.findOne(id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Отримати всі ігрові профілі поточного юзера' })
  findMyProfiles(@CurrentUser() user: JwtPayload) {
    return this.playersService.findMyProfiles(user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Оновити дані гравця (наприклад, змінити нікнейм)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlayerDto: UpdatePlayerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.playersService.update(id, updatePlayerDto, user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Видалити ігровий профіль' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.playersService.remove(id, user.userId);
  }
}
