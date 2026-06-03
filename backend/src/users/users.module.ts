import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesGuard } from 'src/auth/roles.guard';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { MailService } from 'src/mail/mail.service';

@Module({
  exports: [UsersService],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard, AccessPolicyService, MailService],
})
export class UsersModule {}
