import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Leaderboards (Глобальні рейтинги)')
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @Get('teams')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('leaderboard_teams')
  @CacheTTL(60000) // Кешуємо на 1 хвилину
  @ApiOperation({
    summary: 'Глобальний рейтинг команд (з пагінацією та фільтрами)',
  })
  getTeams(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getTeamsLeaderboard(query);
  }

  @Get('players')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('leaderboard_players')
  @CacheTTL(60000)
  @ApiOperation({
    summary: 'Глобальний рейтинг гравців (з пагінацією та фільтрами)',
  })
  getPlayers(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getPlayersLeaderboard(query);
  }
}
