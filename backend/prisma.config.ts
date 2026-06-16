import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Читаємо .env файл
dotenv.config();

// Збираємо URL докупи
const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}?schema=public`;

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'npx ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
