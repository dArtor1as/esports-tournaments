import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Stage } from '@prisma/client';

@ApiTags('Matches (Турнірна сітка та матчі)')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('generate-bracket')
  @ApiOperation({ summary: 'Згенерувати сітку Single Elimination для турніру' })
  generateBracket(@Body() dto: GenerateBracketDto) {
    return this.matchesService.generateSingleElimination(dto);
  }

  @Post('generate-groups')
  @ApiOperation({ summary: 'Згенерувати матчі групового етапу (Round Robin)' })
  generateGroups(@Body() dto: GenerateBracketDto) {
    return this.matchesService.generateGroupStage(dto.tournamentId);
  }

  @Post('transition-to-playoffs')
  @ApiOperation({
    summary: 'Відібрати Топ-8 з груп та призначити їм посіви для Плей-оф',
  })
  transitionToPlayoffs(@Body() dto: GenerateBracketDto) {
    return this.matchesService.transitionToPlayoffs(dto.tournamentId);
  }

  @Get('tournament/:id')
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
    // Якщо параметр передано, приводимо його до верхнього регістру
    const formattedStage = stage ? (stage.toUpperCase() as Stage) : undefined;

    return this.matchesService.findAllByTournament(
      tournamentId,
      formattedStage,
    );
  }
}
