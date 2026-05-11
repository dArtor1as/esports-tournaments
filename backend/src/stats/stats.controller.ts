import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Analytics & Stats (Аналітика)')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Post('tournament/:id/process')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Перерахувати Elo та Lifetime статистику після завершення турніру',
  })
  processTournamentStats(@Param('id') id: string) {
    return this.statsService.processTournamentStats(id);
  }
}
