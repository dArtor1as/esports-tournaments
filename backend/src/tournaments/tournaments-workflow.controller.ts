import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TournamentsWorkflowService } from './tournaments-workflow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { GenerateTestTournamentDto } from './dto/generate-test-tournament.dto';
import { Throttle } from '@nestjs/throttler';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import type { WorkflowMode, TournamentStatus } from './tournaments.types';

@ApiTags('Tournaments (Генерація та Аналітика)')
@Controller('tournaments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TournamentsWorkflowController {
  constructor(private readonly workflowService: TournamentsWorkflowService) {}

  @Get('workflow')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Агрегація даних для організатора (Workflow)' })
  @ApiQuery({
    name: 'workflow',
    required: false,
    enum: ['generation', 'simulation'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['planned', 'live', 'finished', 'cancelled'],
  })
  findWorkflow(
    @Query('workflow') workflow?: WorkflowMode,
    @Query('status') status?: TournamentStatus,
  ) {
    return this.workflowService.findWorkflow(workflow, status);
  }

  @Post('generate-test')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Згенерувати тестовий турнір з командами' })
  generateTestTournament(
    @Body() dto: GenerateTestTournamentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowService.generateTestTournament(dto, user.userId);
  }
}
