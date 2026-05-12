import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { CreateTournamentInvitationDto } from './dto/create-tournament-invitation.dto';
import { AcceptTournamentInvitationDto } from './dto/accept-tournament-invitation.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CacheInterceptor } from 'node_modules/@nestjs/cache-manager/dist/interceptors/cache.interceptor';
import { CacheTTL } from 'node_modules/@nestjs/cache-manager/dist/decorators/cache-ttl.decorator';
import { Throttle } from 'node_modules/@nestjs/throttler/dist/throttler.decorator';

@ApiTags('Tournament Invitations (Запрошення на турнір)')
@Controller('tournament-invitations')
export class TournamentInvitationsController {
  constructor(
    private readonly invitationsService: TournamentInvitationsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Створити запрошення для команди ' })
  create(@Body() createDto: CreateTournamentInvitationDto) {
    return this.invitationsService.create(createDto);
  }

  @Patch(':token/accept')
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Прийняти запрошення та зафіксувати склад команди' })
  accept(
    @Param('token') token: string,
    @Body() acceptDto: AcceptTournamentInvitationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invitationsService.accept(
      token,
      acceptDto.rosterPlayerIds,
      user,
    );
  }

  @Patch(':token/decline')
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Відхилити запрошення на турнір' })
  decline(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.invitationsService.decline(token, user);
  }

  @Get('tournament/:tournamentId')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiOperation({ summary: 'Отримати всі запрошення конкретного турніру' })
  findAllByTournament(@Param('tournamentId') tournamentId: string) {
    return this.invitationsService.findAllByTournament(tournamentId);
  }

  @Get('my-inbox')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Отримати запрошення на турніри для моїх команд (тільки для капітанів)',
  })
  findMyTeamInvites(@CurrentUser() user: JwtPayload) {
    return this.invitationsService.findMyTeamInvites(user.userId);
  }
}
