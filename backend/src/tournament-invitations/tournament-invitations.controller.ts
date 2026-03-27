import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { CreateTournamentInvitationDto } from './dto/create-tournament-invitation.dto';
import { AcceptTournamentInvitationDto } from './dto/accept-tournament-invitation.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Tournament Invitations (Запрошення на турнір)')
@Controller('tournament-invitations')
export class TournamentInvitationsController {
  constructor(
    private readonly invitationsService: TournamentInvitationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Створити запрошення для команди (для Адмінів)' })
  create(@Body() createDto: CreateTournamentInvitationDto) {
    return this.invitationsService.create(createDto);
  }

  @Patch(':token/accept')
  @ApiOperation({ summary: 'Прийняти запрошення та зафіксувати склад команди' })
  accept(
    @Param('token') token: string,
    @Body() acceptDto: AcceptTournamentInvitationDto,
  ) {
    return this.invitationsService.accept(token, acceptDto.rosterPlayerIds);
  }

  @Patch(':token/decline')
  @ApiOperation({ summary: 'Відхилити запрошення на турнір' })
  decline(@Param('token') token: string) {
    return this.invitationsService.decline(token);
  }

  @Get('tournament/:tournamentId')
  @ApiOperation({ summary: 'Отримати всі запрошення конкретного турніру' })
  findAllByTournament(@Param('tournamentId') tournamentId: string) {
    return this.invitationsService.findAllByTournament(tournamentId);
  }
}
