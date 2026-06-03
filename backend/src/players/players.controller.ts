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
  Query,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { TeamTransfersService } from '../teams/team-transfers.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Players (Ігрові профілі)') // Назва розділу в Swagger
@Controller('players')
export class PlayersController {
  constructor(
    private readonly playersService: PlayersService,
    private readonly transfersService: TeamTransfersService,
  ) {}

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
  @CacheTTL(3000) // Кешуємо на 3 секунди
  @ApiOperation({
    summary: 'Отримати список всіх гравців (з їхніми іграми та юзерами)',
  })
  findAll(@Query('userId') userId?: string) {
    return this.playersService.findAll(userId);
  }

  @Get('me')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Отримати всі ігрові профілі поточного юзера' })
  findMyProfiles(@CurrentUser() user: JwtPayload) {
    return this.playersService.findMyProfiles(user.userId);
  }

  @Get(':id')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @ApiOperation({ summary: 'Отримати деталі конкретного гравця за ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.findOne(id);
  }

  @Get(':id/transfers')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Отримати історію команд гравця' })
  getPlayerTransfers(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfersService.getPlayerTransfers(id);
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
    return this.playersService.update(id, updatePlayerDto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Видалити(анонімізувати) ігровий профіль' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.playersService.remove(id, user);
  }
}
