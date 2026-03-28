import {
  PrismaClient,
  Region,
  TournamentFormat,
  RosterRole,
  Stage,
  Bracket,
  Team,
  Prisma,
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

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

const getRandomRating = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  console.log(' Починаємо РОЗУМНИЙ сідінг бази даних...');

  const game = await prisma.game.upsert({
    where: { slug: 'cs2' },
    update: {},
    create: { name: 'Counter-Strike 2', slug: 'cs2' },
  });

  const existingTeamsCount = await prisma.team.count();
  const startIdx = existingTeamsCount + 1;
  const endIdx = existingTeamsCount + 16;
  console.log(
    ` Знайдено ${existingTeamsCount} існуючих команд. Генеруємо команди з ${startIdx} по ${endIdx}...`,
  );

  // Додано обов'язкове поле settings
  const mainTournament = await prisma.tournament.create({
    data: {
      title: `IEM Global Auto-Test ${startIdx}-${endIdx}`,
      gameId: game.id,
      tier: 1,
      region: Region.EU,
      kFactor: 1.0,
      format: TournamentFormat.TEAM,
      maxParticipants: 16,
      settings: { pointsForWin: 3, tiebreakers: ['h2h', 'mapDiff'] },
      status: 'planned',
    },
  });

  // Додано обов'язкове поле settings
  const pastTournament = await prisma.tournament.create({
    data: {
      title: `Past Season Cup ${startIdx}-${endIdx}`,
      gameId: game.id,
      tier: 1,
      region: Region.EU,
      kFactor: 1.0,
      format: TournamentFormat.TEAM,
      maxParticipants: 16,
      settings: { pointsForWin: 3, tiebreakers: ['h2h', 'mapDiff'] },
      status: 'finished',
    },
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  // ЯВНО ВКАЗУЄМО ТИП ДЛЯ МАСИВУ КОМАНД
  const generatedTeams: Team[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const teamName = `Team Auto ${i}`;
    const teamTag = `TA${i}`;
    let totalTeamRating = 0;
    const rosterData: any[] = [];

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

    const team = await prisma.team.create({
      data: {
        name: teamName,
        tag: teamTag,
        captainId: captainPlayer.id,
        averageRating: 1000,
        tier: 1,
      },
    });

    await prisma.player.update({
      where: { id: captainPlayer.id },
      data: { teamId: team.id },
    });
    rosterData.push({ playerId: captainPlayer.id, role: RosterRole.CAPTAIN });

    for (let j = 1; j <= 4; j++) {
      const playerRating = getRandomRating(2500, 3200);
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

    const coachUser = await prisma.user.create({
      data: {
        username: `coach_${i}`,
        email: `coach${i}@test.com`,
        passwordHash,
      },
    });
    const coachPlayer = await prisma.player.create({
      data: {
        userId: coachUser.id,
        gameId: game.id,
        nickname: `Coach_${i}`,
        rating: 1500,
        teamId: team.id,
      },
    });
    rosterData.push({ playerId: coachPlayer.id, role: RosterRole.COACH });

    const avgRating = Math.floor(totalTeamRating / 5);
    await prisma.team.update({
      where: { id: team.id },
      data: { averageRating: avgRating, tier: avgRating >= 2500 ? 1 : 2 },
    });

    const participant = await prisma.tournamentParticipant.create({
      data: {
        tournamentId: mainTournament.id,
        teamId: team.id,
        joinedStage: 'GROUP',
        seed: i - startIdx + 1,
      },
    });

    const finalRosterData = rosterData.map((r) => ({
      participantId: participant.id,
      playerId: r.playerId,
      role: r.role,
    }));
    await prisma.tournamentRoster.createMany({ data: finalRosterData });

    generatedTeams.push(team);
    console.log(
      ` ${teamName} (Avg Elo: ${avgRating}) зареєстрована: 1 CAPTAIN, 4 PLAYER, 1 COACH.`,
    );
  }

  console.log(' Генеруємо історичні матчі для аналітики ГА...');

  // ЯВНО ВКАЗУЄМО ТИП ДЛЯ МАСИВУ МАТЧІВ
  const pastMatches: Prisma.MatchCreateManyInput[] = [];
  const maps = ['Mirage', 'Dust2', 'Inferno', 'Nuke', 'Ancient'];

  for (let i = 0; i < generatedTeams.length; i++) {
    for (let j = i + 1; j < generatedTeams.length; j += 2) {
      const teamA = generatedTeams[i];
      const teamB = generatedTeams[j];

      const isAWinner = Math.random() > 0.5;
      const scoreA = isAWinner ? 2 : Math.random() > 0.5 ? 1 : 0;
      const scoreB = isAWinner
        ? scoreA === 2 && Math.random() > 0.5
          ? 1
          : 0
        : 2;

      // ЯВНО ВКАЗУЄМО ТИП ДЛЯ ДЕТАЛЕЙ КАРТ
      const matchMaps: { map: string; scoreA: number; scoreB: number }[] = [];
      const totalMaps =
        (scoreA === 2 && scoreB === 1) || (scoreB === 2 && scoreA === 1)
          ? 3
          : 2;

      for (let m = 0; m < totalMaps; m++) {
        matchMaps.push({
          map: maps[Math.floor(Math.random() * maps.length)],
          scoreA: Math.floor(Math.random() * 13),
          scoreB: Math.floor(Math.random() * 13),
        });
      }

      pastMatches.push({
        id: uuidv4(),
        tournamentId: pastTournament.id,
        stage: Stage.GROUP,
        bracket: Bracket.NONE,
        round: 1,
        teamAId: teamA.id,
        teamBId: teamB.id,
        scoreA,
        scoreB,
        details: { maps: matchMaps },
        isProcessed: true,
        playedAt: new Date(
          Date.now() - Math.floor(Math.random() * 10000000000),
        ),
      });
    }
  }

  await prisma.match.createMany({ data: pastMatches });
  console.log(
    ` Створено ${pastMatches.length} історичних матчів. База готова до аналізу!`,
  );
}

main()
  .catch((e) => {
    console.error(' Помилка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
