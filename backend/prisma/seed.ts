import {
  PrismaClient,
  Region,
  TournamentFormat,
  RosterRole,
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const dbUser = process.env.POSTGRES_USER;
const dbPass = process.env.POSTGRES_PASSWORD;
const dbHost = process.env.POSTGRES_HOST || 'localhost';
const dbPort = process.env.POSTGRES_PORT;
const dbName = process.env.POSTGRES_DB;

const connectionString = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}?schema=public`;

const pool = new Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

// Допоміжна функція для генерації реалістичного рейтингу
const getRandomRating = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

async function main() {
  console.log('⏳ Починаємо крутий сідінг бази даних...');

  const game = await prisma.game.upsert({
    where: { slug: 'cs2' },
    update: {},
    create: { name: 'Counter-Strike 2', slug: 'cs2' },
  });
  console.log('✅ Гра CS2 готова.');

  const tournament = await prisma.tournament.create({
    data: {
      title: 'IEM Global Auto-Test 2026',
      gameId: game.id,
      tier: 1,
      region: Region.EU,
      kFactor: 1.0,
      format: TournamentFormat.TEAM,
      maxParticipants: 8,
      settings: { pointsForWin: 3, tiebreakers: ['h2h', 'mapDiff'] },
      status: 'planned',
    },
  });
  console.log('✅ Турнір створено.');

  const passwordHash = await bcrypt.hash('password123', 10);

  for (let i = 1; i <= 8; i++) {
    const teamName = `Team Auto ${i}`;
    const teamTag = `TA${i}`;

    let totalTeamRating = 0;
    const rosterData: any[] = [];

    // 1. СТВОРЮЄМО КАПІТАНА
    const captainRating = getRandomRating(2800, 3400);
    totalTeamRating += captainRating;

    const captainUser = await prisma.user.create({
      data: {
        username: `captain_${i}`,
        email: `cap${i}@test.com`,
        passwordHash,
      },
    });
    const captainPlayer = await prisma.player.create({
      data: {
        userId: captainUser.id,
        gameId: game.id,
        nickname: `Cap_${i}`,
        rating: captainRating,
      },
    });

    // 2. СТВОРЮЄМО КОМАНДУ
    const team = await prisma.team.create({
      data: {
        name: teamName,
        tag: teamTag,
        captainId: captainPlayer.id,
        averageRating: 1000, // базове значення, оновлюватимемо після додавання гравців
        tier: 1,
      },
    });

    // Прив'язуємо капітана до команди та додаємо в Roster
    await prisma.player.update({
      where: { id: captainPlayer.id },
      data: { teamId: team.id },
    });
    rosterData.push({ playerId: captainPlayer.id, role: RosterRole.CAPTAIN });

    // 3. СТВОРЮЄМО 4 ОСНОВНИХ ГРАВЦІВ
    for (let j = 1; j <= 4; j++) {
      const playerRating = getRandomRating(2500, 3100);
      totalTeamRating += playerRating;

      const user = await prisma.user.create({
        data: {
          username: `player_${i}_${j}`,
          email: `p_${i}_${j}@test.com`,
          passwordHash,
        },
      });
      const player = await prisma.player.create({
        data: {
          userId: user.id,
          gameId: game.id,
          nickname: `Player_${i}_${j}`,
          rating: playerRating,
          teamId: team.id,
        },
      });
      rosterData.push({ playerId: player.id, role: RosterRole.PLAYER });
    }

    // 4. СТВОРЮЄМО ТРЕНЕРА (COACH)
    const coachUser = await prisma.user.create({
      data: {
        username: `coach_${i}`,
        email: `coach${i}@test.com`,
        passwordHash,
      },
    });
    const coachPlayer = await prisma.player.create({
      // У тренера рейтинг зазвичай нижчий або неважливий
      data: {
        userId: coachUser.id,
        gameId: game.id,
        nickname: `Coach_${i}`,
        rating: getRandomRating(1500, 2000),
        teamId: team.id,
      },
    });
    rosterData.push({ playerId: coachPlayer.id, role: RosterRole.COACH });

    //  5. ОНОВЛЮЄМО СЕРЕДНІЙ РЕЙТИНГ КОМАНДИ (без урахування тренера)
    const avgRating = Math.floor(totalTeamRating / 5);
    await prisma.team.update({
      where: { id: team.id },
      data: { averageRating: avgRating, tier: avgRating >= 2500 ? 1 : 2 },
    });

    //  6. РЕЄСТРУЄМО НА ТУРНІР ТА ФІКСУЄМО РОСТЕР
    const participant = await prisma.tournamentParticipant.create({
      data: {
        tournamentId: tournament.id,
        teamId: team.id,
        joinedStage: 'GROUP',
        seed: i,
      },
    });

    const finalRosterData = rosterData.map((r) => ({
      participantId: participant.id,
      playerId: r.playerId,
      role: r.role,
    }));
    await prisma.tournamentRoster.createMany({ data: finalRosterData });

    console.log(
      ` ${teamName} (Avg Elo: ${avgRating}) зареєстрована: 1 CAPTAIN, 4 PLAYER, 1 COACH.`,
    );
  }

  console.log(' Сідінг завершено! База готова до генерації турнірної сітки.');
}

main()
  .catch((e) => {
    console.error(' Помилка під час сідінгу:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
