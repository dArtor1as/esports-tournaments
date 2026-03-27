import { Controller, Post, Body } from '@nestjs/common';
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
}
