import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Players (Ігрові профілі)') // Назва розділу в Swagger
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Створити ігровий профіль для користувача' })
  create(@Body() createPlayerDto: CreatePlayerDto, @CurrentUser() user: JwtPayload) {
    return this.playersService.create(createPlayerDto, user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Отримати список всіх гравців (з їхніми іграми та юзерами)',
  })
  findAll() {
    return this.playersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати деталі конкретного гравця за ID' })
  findOne(@Param('id') id: string) {
    return this.playersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Оновити дані гравця (наприклад, змінити нікнейм)' })
  update(@Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
    return this.playersService.update(id, updatePlayerDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Видалити ігровий профіль' })
  remove(@Param('id') id: string) {
    return this.playersService.remove(id);
  }
}
