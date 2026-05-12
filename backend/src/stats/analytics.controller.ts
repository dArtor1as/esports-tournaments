import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { StatsService } from './stats.service';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Analytics & History (Графіки)')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('team/:teamId/rating-history')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({
    summary: 'Історія зміни Elo команди (для лінійного графіка)',
  })
  @ApiParam({ name: 'teamId', description: 'ID команди' })
  getTeamHistory(@Param('teamId') teamId: string) {
    return this.statsService.getTeamRatingHistory(teamId);
  }

  @Get('player/:playerId/rating-history')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Історія зміни Elo гравця (для лінійного графіка)' })
  @ApiParam({ name: 'playerId', description: 'ID гравця' })
  getPlayerHistory(@Param('playerId') playerId: string) {
    return this.statsService.getPlayerRatingHistory(playerId);
  }
}
