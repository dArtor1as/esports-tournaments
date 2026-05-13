import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Stage } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { MatchesQueryService } from './matches-query.service';
import { MatchesQueryDto } from './dto/matches-query.dto';

@ApiTags('Matches Queries (Перегляд матчів)')
@Controller('matches')
export class MatchesQueryController {
  constructor(private queryService: MatchesQueryService) {}

  @Get('recent')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000) // Кеш на 30 секунд
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Стрічка останніх результатів (Recent Results)' })
  getRecent() {
    return this.queryService.getRecentResults();
  }

  @Get('disputed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Глобальний список конфліктних матчів (тільки для ADMIN)',
  })
  getGlobalDisputed() {
    return this.queryService.getAllDisputedMatches();
  }

  @Get('tournament/:id/disputed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Конфліктні матчі конкретного турніру (для Організатора)',
  })
  getTournamentDisputed(
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.queryService.getTournamentDisputedMatches(tournamentId, user);
  }

  @Get('tournament/:id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Отримати всі матчі турніру (Сітка)' })
  @ApiQuery({
    name: 'stage',
    enum: Stage,
    required: false,
    description: 'Фільтр за стадією турніру',
  })
  findAllByTournament(
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @Query() query: MatchesQueryDto,
  ) {
    const formattedStage = query.stage
      ? (query.stage.toUpperCase() as Stage)
      : undefined;
    return this.queryService.findAllByTournament(tournamentId, formattedStage);
  }

  @Get('team/:teamId/upcoming')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Розклад майбутніх матчів конкретної команди' })
  getUpcoming(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.queryService.getUpcomingMatches(teamId);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Детальна сторінка матчу (Match Room)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryService.findOne(id);
  }
}
