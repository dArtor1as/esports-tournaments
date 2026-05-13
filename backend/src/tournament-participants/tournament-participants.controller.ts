import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TournamentParticipantsService } from './tournament-participants.service';
import { CreateTournamentParticipantDto } from './dto/create-tournament-participant.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Tournament Participants (Реєстрація команд)')
@Controller('tournament-participants')
export class TournamentParticipantsController {
  constructor(
    private readonly participantsService: TournamentParticipantsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 20, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Зареєструвати команду на турнір та зафіксувати склад',
  })
  create(
    @Body() createDto: CreateTournamentParticipantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.participantsService.create(createDto, user);
  }

  @Get('tournament/:tournamentId')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({
    summary: 'Отримати список усіх зареєстрованих команд конкретного турніру',
  })
  findAllByTournament(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.participantsService.findAllByTournament(tournamentId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Скасувати реєстрацію команди (тільки до старту)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.participantsService.remove(id, user);
  }
}
