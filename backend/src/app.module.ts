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
import { MatchSimulatorsModule } from './match-simulators/match-simulators.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from './mail/mail.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { StatsModule } from './stats/stats.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';

@Module({
  imports: [
    // Реєструємо глобально першим, щоб всі інші модулі могли використовувати змінні середовища
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST') || 'localhost',
        port: configService.get<number>('REDIS_PORT') || 6379,
        ttl: 60000, //  час життя кешу (60 секунд)
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100, // 100 запитів на хвилину
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 10, // 10 запитів на хвилину для авторизації
      },
      {
        name: 'invitations',
        ttl: 60000,
        limit: 5, // 5 запитів на хвилину для запрошень (щоб уникнути спаму)
      },
      {
        name: 'heavy',
        ttl: 60000,
        limit: 3, // 3 запити на хвилину для симуляцій/генерацій
      },
    ]),
    PrismaModule,
    UsersModule,
    PlayersModule,
    TeamsModule,
    TournamentsModule,
    MatchesModule,
    GamesModule,
    TeamInvitationsModule,
    TournamentParticipantsModule,
    TournamentInvitationsModule,
    GeneticSimulatorModule,
    MatchSimulatorsModule,
    AuthModule,
    MailModule,
    StatsModule,
    LeaderboardsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
