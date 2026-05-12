import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesGuard } from 'src/auth/roles.guard';

@Module({
  exports: [UsersService],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
})
export class UsersModule {}
