import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Tournaments (Турніри)')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @ApiOperation({ summary: 'Створити новий турнір' })
  create(@Body() createTournamentDto: CreateTournamentDto) {
    return this.tournamentsService.create(createTournamentDto);
  }

  @Post('generate-test')
  @ApiOperation({
    summary: 'Створити тестовий турнір і випадково зареєструвати N існуючих команд',
  })
  generateTestTournament(@Body() dto: GenerateTestTournamentDto) {
    return this.tournamentsService.generateTestTournament(dto.teamCount);
  }

  @Get()
  @ApiOperation({ summary: 'Отримати список усіх турнірів' })
  @ApiQuery({
    name: 'workflow',
    required: false,
    enum: ['generation', 'simulation'],
    description:
      'Фільтр під UI workflow: generation (planned), simulation (є згенерована сітка)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['planned', 'live', 'finished'],
    description: 'Необовʼязковий фільтр за статусом турніру',
  })
  findAll() {
    return this.tournamentsService.findAll();
  }

  @Get('workflow')
  @ApiOperation({
    summary: 'Отримати турніри для екрану генерації або симуляції',
  })
  @ApiQuery({
    name: 'workflow',
    required: false,
    enum: ['generation', 'simulation'],
    description:
      'generation -> planned; simulation -> турніри з уже згенерованими матчами',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['planned', 'live', 'finished'],
    description: 'Опціональний фільтр за статусом',
  })
  findWorkflow(
    @Query('workflow') workflow?: string,
    @Query('status') status?: string,
  ) {
    return this.tournamentsService.findWorkflow(workflow, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати деталі турніру за ID' })
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Оновити налаштування турніру (до старту)' })
  update(
    @Param('id') id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(id, updateTournamentDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Видалити турнір (тільки якщо він ще не розпочався)',
  })
  remove(@Param('id') id: string) {
    return this.tournamentsService.remove(id);
  }
}
