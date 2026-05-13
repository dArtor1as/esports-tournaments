import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { StatsAnalyticsService } from './stats-analytics.service';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Analytics & History (Графіки)')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly statsAnalyticsService: StatsAnalyticsService) {}

  @Get('team/:teamId/rating-history')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({
    summary: 'Історія зміни Elo команди (для лінійного графіка)',
  })
  @ApiParam({ name: 'teamId', description: 'ID команди' })
  getTeamHistory(@Param('teamId') teamId: string) {
    return this.statsAnalyticsService.getTeamRatingHistory(teamId);
  }

  @Get('player/:playerId/rating-history')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Історія зміни Elo гравця (для лінійного графіка)' })
  @ApiParam({ name: 'playerId', description: 'ID гравця' })
  getPlayerHistory(@Param('playerId') playerId: string) {
    return this.statsAnalyticsService.getPlayerRatingHistory(playerId);
  }
}
