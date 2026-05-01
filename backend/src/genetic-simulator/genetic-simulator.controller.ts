import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Genetic Simulator (Алгоритм)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('genetic-simulator')
export class GeneticSimulatorController {
  constructor(
    private readonly geneticSimulatorService: GeneticSimulatorService,
  ) {}

  @Post('run')
  @ApiOperation({
    summary: 'Запустити генетичний алгоритм для заповнення сітки турніру',
  })
  run(@Body() dto: SimulateTournamentDto, @CurrentUser() user: JwtPayload) {
    return this.geneticSimulatorService.runSimulation(dto, user);
  }

  @Post('run-groups')
  @ApiOperation({
    summary: 'Запустити генетичний алгоритм для ГРУПОВОГО етапу (Round Robin)',
  })
  runGroups(
    @Body() dto: SimulateTournamentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.geneticSimulatorService.runGroupSimulation(dto, user);
  }

  @Get('tournament/:id/runs')
  @ApiOperation({ summary: 'Отримати історію запусків GA для турніру' })
  getTournamentRuns(
    @Param('id') tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.geneticSimulatorService.findRunsByTournament(
      tournamentId,
      user,
    );
  }
}
