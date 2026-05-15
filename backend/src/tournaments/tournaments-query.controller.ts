import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TournamentsQueryService } from './tournaments-query.service';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Region } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Tournaments (Пошук та Читання)')
@Controller('tournaments')
export class TournamentsQueryController {
  constructor(private readonly queryService: TournamentsQueryService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('all_tournaments')
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Отримати список всіх турнірів' })
  findAll() {
    return this.queryService.findAll();
  }

  @Get('public')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({
    summary: 'Отримати активні публічні турніри (Для головної сторінки)',
  })
  findPublicActiveTournaments() {
    return this.queryService.findPublicActiveTournaments();
  }

  @Get('search')
  @ApiOperation({ summary: 'Фільтрація турнірів (за грою, регіоном, рівнем)' })
  @ApiQuery({ name: 'gameSlug', required: false })
  @ApiQuery({ name: 'region', required: false, enum: Region })
  @ApiQuery({ name: 'tier', required: false, type: Number })
  searchTournaments(
    @Query('gameSlug') gameSlug?: string,
    @Query('region') region?: Region,
    @Query('tier') tier?: number,
  ) {
    return this.queryService.searchTournaments({ gameSlug, region, tier });
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Отримати список турнірів, які створив поточний користувач',
  })
  findMyTournaments(@CurrentUser() user: JwtPayload) {
    return this.queryService.findMyTournaments(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати деталі турніру за ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryService.findOne(id);
  }
}
