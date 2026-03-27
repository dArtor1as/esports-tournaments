import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Matches (Турнірна сітка та матчі)')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('generate-bracket')
  @ApiOperation({ summary: 'Згенерувати сітку Single Elimination для турніру' })
  generateBracket(@Body() dto: GenerateBracketDto) {
    return this.matchesService.generateSingleElimination(dto);
  }

  @Get('tournament/:tournamentId')
  @ApiOperation({ summary: 'Отримати всі матчі конкретного турніру' })
  findAllByTournament(@Param('tournamentId') tournamentId: string) {
    return this.matchesService.findAllByTournament(tournamentId);
  }
}
