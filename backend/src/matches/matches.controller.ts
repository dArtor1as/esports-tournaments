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
import { CacheTTL } from 'node_modules/@nestjs/cache-manager/dist/decorators/cache-ttl.decorator';
import { CacheInterceptor } from 'node_modules/@nestjs/cache-manager/dist/interceptors/cache.interceptor';

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
}
