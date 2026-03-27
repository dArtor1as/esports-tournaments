import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { TeamInvitationsService } from './team-invitations.service';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-team-invitation.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Team Invitations (Запрошення в команду)')
@Controller('team-invitations')
export class TeamInvitationsController {
  constructor(
    private readonly teamInvitationsService: TeamInvitationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Згенерувати посилання-запрошення для користувача' })
  create(@Body() createTeamInvitationDto: CreateTeamInvitationDto) {
    return this.teamInvitationsService.create(createTeamInvitationDto);
  }

  @Patch(':token/accept')
  @ApiOperation({ summary: 'Прийняти запрошення за токеном' })
  accept(
    @Param('token') token: string,
    @Body() acceptDto: AcceptInvitationDto,
  ) {
    return this.teamInvitationsService.accept(token, acceptDto.playerId);
  }

  @Patch(':token/decline')
  @ApiOperation({ summary: 'Відхилити запрошення за токеном' })
  decline(@Param('token') token: string) {
    return this.teamInvitationsService.decline(token);
  }

  @Get()
  @ApiOperation({ summary: 'Отримати список всіх інвайтів' })
  findAll() {
    return this.teamInvitationsService.findAll();
  }
}
