import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { TournamentInvitationsService } from './tournament-invitations.service';
import { CreateTournamentInvitationDto } from './dto/create-tournament-invitation.dto';
import { AcceptTournamentInvitationDto } from './dto/accept-tournament-invitation.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Tournament Invitations (Запрошення на турнір)')
@Controller('tournament-invitations')
export class TournamentInvitationsController {
  constructor(
    private readonly invitationsService: TournamentInvitationsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Створити запрошення для команди (для Адмінів)' })
  create(@Body() createDto: CreateTournamentInvitationDto) {
    return this.invitationsService.create(createDto);
  }

  @Patch(':token/accept')
  @UseGuards(JwtAuthGuard)
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Відхилити запрошення на турнір' })
  decline(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.invitationsService.decline(token, user);
  }

  @Get('tournament/:tournamentId')
  @ApiOperation({ summary: 'Отримати всі запрошення конкретного турніру' })
  findAllByTournament(@Param('tournamentId') tournamentId: string) {
    return this.invitationsService.findAllByTournament(tournamentId);
  }
}
