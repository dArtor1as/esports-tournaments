import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 1. Збираємо URL зі змінних оточення
    const dbUser = process.env.POSTGRES_USER;
    const dbPass = process.env.POSTGRES_PASSWORD;
    const dbHost = process.env.POSTGRES_HOST || 'localhost';
    const dbPort = process.env.POSTGRES_PORT;
    const dbName = process.env.POSTGRES_DB;

    const connectionString = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}?schema=public`;

    // 2. Створюємо пул з'єднань через нативний драйвер pg
    const pool = new Pool({ connectionString });

    // 3. Ініціалізуємо адаптер Prisma
    // Ігноруємо конфлікт вкладених типів @types/pg
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const adapter = new PrismaPg(pool as any);

    // 4. Передаємо адаптер у батьківський клас PrismaClient
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
