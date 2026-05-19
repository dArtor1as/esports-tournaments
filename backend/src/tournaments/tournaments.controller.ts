import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Tournaments (Турніри)')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Створити новий турнір' })
  create(
    @Body() createTournamentDto: CreateTournamentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.create(createTournamentDto, user.userId);
  }

  @Post(':id/finish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Остаточно закрити турнір (після групового етапу)',
  })
  finish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.finishTournament(id, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Видалити турнір (тільки якщо він ще не розпочався)',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.remove(id, user);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Екстрено скасувати турнір (закриває всі незіграні матчі)',
  })
  cancelTournament(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.cancelTournament(id, user);
  }
}
