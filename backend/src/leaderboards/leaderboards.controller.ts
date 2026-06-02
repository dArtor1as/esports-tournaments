import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Leaderboards (Глобальні рейтинги)')
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @Get('teams')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3000) // Кешуємо на 3 секунди, щоб зменшити навантаження при частих запитах
  @ApiOperation({
    summary: 'Глобальний рейтинг команд (з пагінацією та фільтрами)',
  })
  getTeams(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getTeamsLeaderboard(query);
  }

  @Get('players')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3000) // Кешуємо на 3 секунди, щоб зменшити навантаження при частих запитах
  @ApiOperation({
    summary: 'Глобальний рейтинг гравців (з пагінацією та фільтрами)',
  })
  getPlayers(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getPlayersLeaderboard(query);
  }
}
