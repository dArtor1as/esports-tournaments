import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TournamentParticipantsService } from './tournament-participants.service';
import { CreateTournamentParticipantDto } from './dto/create-tournament-participant.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CacheTTL } from 'node_modules/@nestjs/cache-manager/dist/decorators/cache-ttl.decorator';
import { CacheInterceptor } from 'node_modules/@nestjs/cache-manager/dist/interceptors/cache.interceptor';

@ApiTags('Tournament Participants (Реєстрація команд)')
@Controller('tournament-participants')
export class TournamentParticipantsController {
  constructor(
    private readonly participantsService: TournamentParticipantsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Зареєструвати команду на турнір та зафіксувати склад',
  })
  create(@Body() createDto: CreateTournamentParticipantDto) {
    return this.participantsService.create(createDto);
  }

  @Get('tournament/:tournamentId')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({
    summary: 'Отримати список усіх зареєстрованих команд конкретного турніру',
  })
  findAllByTournament(@Param('tournamentId') tournamentId: string) {
    return this.participantsService.findAllByTournament(tournamentId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Скасувати реєстрацію команди (тільки до старту)' })
  remove(@Param('id') id: string) {
    return this.participantsService.remove(id);
  }
}
