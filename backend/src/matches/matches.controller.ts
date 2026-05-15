import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { ForfeitMatchDto } from './dto/forfeit-match.dto';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { DisputeMatchDto, ReportScoreDto } from './dto/consensus.dto';
import { MatchesProgressionService } from './matches-progression.service';
import { MatchesConsensusService } from './matches-consensus.service';
import { MatchesGeneratorService } from './matches-generator.service';

@ApiTags('Matches (Турнірна сітка та матчі)')
@Controller('matches')
export class MatchesController {
  constructor(
    private generatorService: MatchesGeneratorService,
    private consensusService: MatchesConsensusService,
    private progressionService: MatchesProgressionService,
  ) {}

  @Post('generate-bracket')
  @UseGuards(JwtAuthGuard)
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Згенерувати сітку для турніру (Single або Double Elimination)',
  })
  generateBracket(
    @Body() dto: GenerateBracketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.generatorService.generateBracket(dto, user);
  }

  @Post('generate-groups')
  @UseGuards(JwtAuthGuard)
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Згенерувати матчі групового етапу (Round Robin)' })
  generateGroups(
    @Body() dto: GenerateBracketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.generatorService.generateGroupStage(dto, user);
  }

  @Post('transition-to-playoffs')
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Відібрати Топ-8 з груп та призначити їм посіви для Плей-оф',
  })
  transitionToPlayoffs(
    @Body() dto: GenerateBracketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.progressionService.transitionToPlayoffs(dto.tournamentId, user);
  }
  @Post(':id/forfeit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Здатися у поточному матчі або видати технічну поразку (FF)',
  })
  forfeitMatch(
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: ForfeitMatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.consensusService.forfeitMatch(matchId, dto, user);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Капітан вносить рахунок (Чекає підтвердження)' })
  reportMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportScoreDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.consensusService.reportMatch(id, dto, user);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Капітан-опонент підтверджує рахунок' })
  confirmMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.consensusService.confirmMatch(id, user);
  }

  @Post(':id/dispute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Капітан-опонент оскаржує рахунок' })
  disputeMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeMatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.consensusService.disputeMatch(id, dto, user);
  }

  @Post(':id/force-resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Адмін примусово закриває матч (вирішує конфлікт)' })
  forceResolveMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportScoreDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.consensusService.forceResolveMatch(id, dto, user);
  }
}
