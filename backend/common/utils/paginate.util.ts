import { Prisma } from '@prisma/client';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Створюємо інтерфейс для моделі Prisma, щоб уникнути any
interface PrismaModel {
  findMany: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
}

export async function paginate<T>(
  model: PrismaModel,
  where: object = {},
  query: { page?: number; limit?: number },
  include?: object,
  orderBy: object = { createdAt: 'desc' },
): Promise<PaginatedResult<T>> {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const skip = (page - 1) * limit;

  // Використовуємо Promise.all для швидкості
  const [data, total] = await Promise.all([
    model.findMany({
      where,
      skip,
      take: limit,
      include,
      orderBy,
    }),
    model.count({ where }),
  ]);

  return {
    data: data as T[], // Кастуємо до потрібного типу
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
