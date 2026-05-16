import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export async function seedCommon(prisma: PrismaClient) {
  console.log('Сідінг спільних даних...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@esports.com' },
    update: {},
    create: {
      username: 'super_admin',
      email: 'admin@esports.com',
      passwordHash,
      role: Role.ADMIN,
      birthDate: new Date('2005-05-05'),
    },
  });

  const cs2 = await prisma.game.upsert({
    where: { slug: 'cs2' },
    update: {},
    create: { name: 'Counter-Strike 2', slug: 'cs2', minTeamSize: 5 },
  });

  const dota2 = await prisma.game.upsert({
    where: { slug: 'dota2' },
    update: {},
    create: { name: 'Dota 2', slug: 'dota2', minTeamSize: 5 },
  });

  return { admin, games: { cs2, dota2 } };
}
