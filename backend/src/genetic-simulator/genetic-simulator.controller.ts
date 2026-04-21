import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Genetic Simulator (Алгоритм)')
@Controller('genetic-simulator')
export class GeneticSimulatorController {
  constructor(
    private readonly geneticSimulatorService: GeneticSimulatorService,
  ) {}

  @Post('run')
  @ApiOperation({
    summary: 'Запустити генетичний алгоритм для заповнення сітки турніру',
  })
  run(@Body() dto: SimulateTournamentDto) {
    return this.geneticSimulatorService.runSimulation(dto);
  }

  @Post('run-groups')
  @ApiOperation({
    summary: 'Запустити генетичний алгоритм для ГРУПОВОГО етапу (Round Robin)',
  })
  runGroups(@Body() dto: SimulateTournamentDto) {
    return this.geneticSimulatorService.runGroupSimulation(dto);
  }

  @Get('tournament/:id/runs')
  @ApiOperation({ summary: 'Отримати історію запусків GA для турніру' })
  getTournamentRuns(@Param('id') tournamentId: string) {
    return this.geneticSimulatorService.findRunsByTournament(tournamentId);
  }
}
