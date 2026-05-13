import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Stage } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ReportScoreDto, DisputeMatchDto } from './dto/consensus.dto';

@ApiTags('Matches (Турнірна сітка та матчі)')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('generate-bracket')
  @UseGuards(JwtAuthGuard)
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Згенерувати сітку для турніру (Single або Double Elimination)',
  })
  generateBracket(@Body() dto: GenerateBracketDto) {
    return this.matchesService.generateBracket(dto);
  }

  @Post('generate-groups')
  @UseGuards(JwtAuthGuard)
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Згенерувати матчі групового етапу (Round Robin)' })
  generateGroups(@Body() dto: GenerateBracketDto) {
    return this.matchesService.generateGroupStage(dto);
  }

  @Post('transition-to-playoffs')
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Відібрати Топ-8 з груп та призначити їм посіви для Плей-оф',
  })
  transitionToPlayoffs(@Body() dto: GenerateBracketDto) {
    return this.matchesService.transitionToPlayoffs(dto.tournamentId);
  }

  @Get('tournament/:id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Отримати всі матчі турніру' })
  @ApiQuery({
    name: 'stage',
    enum: Stage,
    required: false,
    description: 'Фільтр за стадією турніру',
  })
  findAllByTournament(
    @Param('id') tournamentId: string,
    @Query('stage') stage?: string,
  ) {
    const formattedStage = stage ? (stage.toUpperCase() as Stage) : undefined;
    return this.matchesService.findAllByTournament(
      tournamentId,
      formattedStage,
    );
  }
  @Post(':id/forfeit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Здатися у поточному матчі або видати технічну поразку (FF)',
  })
  forfeitMatch(
    @Param('id') matchId: string,
    @Body() dto: ForfeitMatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.matchesService.forfeitMatch(matchId, dto, user);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Капітан вносить рахунок (Чекає підтвердження)' })
  reportMatch(
    @Param('id') id: string,
    @Body() dto: ReportScoreDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.matchesService.reportMatch(id, dto, user);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Капітан-опонент підтверджує рахунок' })
  confirmMatch(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.matchesService.confirmMatch(id, user);
  }

  @Post(':id/dispute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Капітан-опонент оскаржує рахунок' })
  disputeMatch(
    @Param('id') id: string,
    @Body() dto: DisputeMatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.matchesService.disputeMatch(id, dto, user);
  }

  @Post(':id/force-resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Адмін примусово закриває матч (вирішує конфлікт)' })
  forceResolveMatch(
    @Param('id') id: string,
    @Body() dto: ReportScoreDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.matchesService.forceResolveMatch(id, dto, user);
  }
}
