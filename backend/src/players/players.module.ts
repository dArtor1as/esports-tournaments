import { Module } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { TeamsModule } from 'src/teams/teams.module';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Module({
  imports: [TeamsModule],
  controllers: [PlayersController],
  providers: [PlayersService, AccessPolicyService],
  exports: [PlayersService],
})
export class PlayersModule {}
