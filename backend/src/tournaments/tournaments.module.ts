import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { TournamentsWorkflowController } from './tournaments-workflow.controller';
import { TournamentsQueryController } from './tournaments-query.controller';
import { TournamentsQueryService } from './tournaments-query.service';
import { TournamentsWorkflowService } from './tournaments-workflow.service';

@Module({
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
