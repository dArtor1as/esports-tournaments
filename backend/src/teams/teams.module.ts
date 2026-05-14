import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { TeamTransfersService } from './team-transfers.service';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, AccessPolicyService, TeamTransfersService],
  exports: [TeamsService, TeamTransfersService],
})
export class TeamsModule {}
