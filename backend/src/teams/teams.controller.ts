import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { TeamTransfersService } from './team-transfers.service';

@ApiTags('Teams (Команди)')
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly transfersService: TeamTransfersService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Створити нову команду' })
  create(
    @Body() createTeamDto: CreateTeamDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.create(createTeamDto, user.userId);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('all_teams')
  @CacheTTL(30000) // Кешуємо на 30 секунд
  @ApiOperation({ summary: 'Отримати список всіх команд' })
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати інформацію про команду та її гравців' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Оновити дані команди (ребрендинг)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.update(id, updateTeamDto, user);
  }

  @Patch(':id/transfer-leadership')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Передати права капітана іншому учаснику команди' })
  transferLeadership(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Body('newCaptainPlayerId', ParseUUIDPipe) newCaptainPlayerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transfersService.transferLeadership(
      teamId,
      newCaptainPlayerId,
      user,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Видалити команду (дісбанд)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.remove(id, user);
  }
  @Delete(':id/leave/:playerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Гравець самостійно покидає команду' })
  leaveTeam(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transfersService.leaveTeam(teamId, playerId, user);
  }

  @Delete(':id/kick/:playerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Капітан виключає гравця з команди' })
  kickPlayer(
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transfersService.kickPlayer(teamId, playerId, user);
  }

  @Get(':id/transfers')
  @ApiOperation({ summary: 'Отримати лог трансферів команди' })
  getTeamTransfers(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfersService.getTeamTransfers(id);
  }
}
