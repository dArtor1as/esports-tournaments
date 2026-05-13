import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GeneticSimulatorService } from './genetic-simulator.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Genetic Simulator (Алгоритм)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('genetic-simulator')
export class GeneticSimulatorController {
  constructor(
    private readonly geneticSimulatorService: GeneticSimulatorService,
  ) {}

  @Post('run')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Запустити генетичний алгоритм для заповнення сітки турніру',
  })
  run(@Body() dto: SimulateTournamentDto, @CurrentUser() user: JwtPayload) {
    return this.geneticSimulatorService.runSimulation(dto, user);
  }

  @Post('run-groups')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ heavy: { limit: 3, ttl: 60000 } })
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
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.geneticSimulatorService.findRunsByTournament(
      tournamentId,
      user,
    );
  }
}
