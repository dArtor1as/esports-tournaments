import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

import { seedCommon } from './seeds/common.seed';
import { seedCS2 } from './seeds/cs2.seed';
import { seedDota2 } from './seeds/dota2.seed';

// Читаємо змінні середовища з .env
dotenv.config();

// Формуємо рядок підключення
const connectionString = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}?schema=public`;

// Ініціалізуємо пул та адаптер для Prisma
const pool = new Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);

// Передаємо адаптер при створенні клієнта!
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(' [SEED] Початок глобального сідінгу...');
  try {
    // Крок 1: Базові дані
    console.log(' [SEED] Перевірка базових даних (Адмін та Ігри)...');
    const { admin, games } = await seedCommon(prisma);
    console.log(' [SEED] Базові дані успішно синхронізовано.');

    // Крок 2: Модуль CS2
    console.log(' [SEED] Запуск екосистеми Counter-Strike 2...');
    await seedCS2(prisma, admin, games.cs2);
    console.log(' [SEED] Екосистему CS2 успішно опрацьовано.');

    // Крок 3: Модуль Dota 2
    console.log(' [SEED] Запуск екосистеми Dota 2...');
    await seedDota2(prisma, admin, games.dota2);
    console.log(' [SEED] Екосистему Dota 2 успішно опрацьовано.');

    console.log(' [SEED] Глобальний сідінг бази даних виконано на 100%!');
  } catch (error) {
    console.error(
      ' [SEED CRITICAL] Сталася критична помилка всередині процесу сідінгу!',
    );
    console.error(error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(' [SEED FAULT] Помилка під час сідінгу:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
