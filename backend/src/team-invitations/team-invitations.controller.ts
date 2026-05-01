import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { TeamInvitationsService } from './team-invitations.service';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AcceptTeamInvitationDto } from './dto/accept-team-invitation.dto';

@ApiTags('Team Invitations (Запрошення в команду)')
@Controller('team-invitations')
export class TeamInvitationsController {
  constructor(
    private readonly teamInvitationsService: TeamInvitationsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Згенерувати посилання-запрошення для користувача' })
  create(@Body() createTeamInvitationDto: CreateTeamInvitationDto) {
    return this.teamInvitationsService.create(createTeamInvitationDto);
  }

  @Patch(':token/accept')
  @UseGuards(JwtAuthGuard)
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Відхилити запрошення за токеном' })
  decline(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.teamInvitationsService.decline(token, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Отримати список всіх інвайтів' })
  findAll() {
    return this.teamInvitationsService.findAll();
  }
}
