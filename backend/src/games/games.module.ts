import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { RolesGuard } from 'src/auth/roles.guard';

@Module({
  controllers: [GamesController],
  providers: [GamesService, RolesGuard],
})
export class GamesModule {}
