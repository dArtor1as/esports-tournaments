import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PlayersModule } from './players/players.module';
import { TeamsModule } from './teams/teams.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { MatchesModule } from './matches/matches.module';
import { GamesModule } from './games/games.module';
import { TeamInvitationsModule } from './team-invitations/team-invitations.module';
import { TournamentParticipantsModule } from './tournament-participants/tournament-participants.module';
import { TournamentInvitationsModule } from './tournament-invitations/tournament-invitations.module';
import { GeneticSimulatorModule } from './genetic-simulator/genetic-simulator.module';

@Module({
  imports: [PrismaModule, UsersModule, PlayersModule, TeamsModule, TournamentsModule, MatchesModule, GamesModule, TeamInvitationsModule, TournamentParticipantsModule, TournamentInvitationsModule, GeneticSimulatorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
