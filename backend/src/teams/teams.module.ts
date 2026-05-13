import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, AccessPolicyService],
})
export class TeamsModule {}
