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
import { TeamInvitationsService } from './team-invitations.service';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AcceptTeamInvitationDto } from './dto/accept-team-invitation.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Throttle } from '@nestjs/throttler';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Team Invitations (Запрошення в команду)')
@Controller('team-invitations')
export class TeamInvitationsController {
  constructor(
    private readonly teamInvitationsService: TeamInvitationsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Згенерувати посилання-запрошення для користувача',
  })
  create(
    @Body() createTeamInvitationDto: CreateTeamInvitationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamInvitationsService.create(createTeamInvitationDto, user);
  }

  @Patch(':token/accept')
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Прийняти запрошення за токеном' })
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptTeamInvitationDto, // Повертаємо DTO
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamInvitationsService.accept(token, dto.playerId, user.userId);
  }

  @Patch(':token/decline')
  @UseGuards(JwtAuthGuard)
  @Throttle({ invitations: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Відхилити запрошення за токеном' })
  decline(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.teamInvitationsService.decline(token, user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Отримати список всіх інвайтів (тільки Адмін)' })
  findAll() {
    return this.teamInvitationsService.findAll();
  }

  @Get('my-invites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Отримати мої вхідні запрошення в команди' })
  findMyInvites(@CurrentUser() user: JwtPayload) {
    return this.teamInvitationsService.findMyInvites(user.userId);
  }
}
