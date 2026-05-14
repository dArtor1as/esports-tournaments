import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TournamentsQueryService } from './tournaments-query.service';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
