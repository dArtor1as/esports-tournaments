import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { TournamentsWorkflowController } from './tournaments-workflow.controller';
import { TournamentsQueryController } from './tournaments-query.controller';
import { TournamentsQueryService } from './tournaments-query.service';
import { TournamentsWorkflowService } from './tournaments-workflow.service';
import { StatsService } from 'src/stats/stats.service';
import { TeamsService } from 'src/teams/teams.service';
import { PlayersService } from 'src/players/players.service';
import { StatsModule } from 'src/stats/stats.module';

@Module({
  imports: [StatsModule],
  controllers: [
    TournamentsController, // Мутації (Create, Update, Delete, Cancel)
    TournamentsQueryController, // Читання (Find, Search)
    TournamentsWorkflowController, // Адмін-логіка (Workflow, Test Gen)
  ],
  providers: [
    TournamentsService,
    AccessPolicyService,
    TournamentsQueryService,
    TournamentsWorkflowService,
  ],
})
export class TournamentsModule {}
