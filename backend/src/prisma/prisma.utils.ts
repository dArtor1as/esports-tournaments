import { Prisma } from '@prisma/client';

/**
 * Безпечно перетворюємо доменні типи об'єктів у формат, який приймає Prisma для JSON-полів.
 * Це ховає `as unknown as Prisma.InputJsonValue` в одному місці системи.
 */
export function toPrismaJson<T>(data: T): Prisma.InputJsonValue {
  return data as unknown as Prisma.InputJsonValue;
}
