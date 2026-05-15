import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [HealthController],
  imports: [PrismaModule],
})
export class HealthModule {}
