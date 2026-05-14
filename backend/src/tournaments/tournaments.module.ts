import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Module({
  controllers: [TournamentsController],
  providers: [TournamentsService, AccessPolicyService],
})
export class TournamentsModule {}
