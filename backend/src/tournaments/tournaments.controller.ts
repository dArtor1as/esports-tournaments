import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';
import {
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Tournaments (Турніри)')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Створити новий турнір' })
  create(
    @Body() createTournamentDto: CreateTournamentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.create(createTournamentDto, user.userId);
  }

  @Post('generate-test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Створити турнір із кастомними налаштуваннями',
  })
  generateTestTournament(
    @Body() dto: GenerateTestTournamentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.generateTestTournament(dto, user.userId);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('all_tournaments')
  @CacheTTL(30000) // Кешуємо на 30 секунд
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
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000) // Кешуємо на 30 секунд
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Оновити налаштування турніру (до старту)' })
  update(
    @Param('id') id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(id, updateTournamentDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Видалити турнір (тільки якщо він ще не розпочався)',
  })
  remove(@Param('id') id: string) {
    return this.tournamentsService.remove(id);
  }
}
