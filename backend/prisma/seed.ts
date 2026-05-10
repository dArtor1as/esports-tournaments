import {
  PrismaClient,
  Region,
  TournamentFormat,
  RosterRole,
  Stage,
  Bracket,
  Prisma,
  Team,
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { Cs2SimulatorService } from '../src/match-simulators/simulators/cs2-simulator.service';

dotenv.config();

const connectionString = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}?schema=public`;
const pool = new Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const getRandomRating = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const realTeams = [
  { name: 'Natus Vincere', tag: 'NAVI', region: Region.EU },
  { name: 'FaZe Clan', tag: 'FaZe', region: Region.EU },
  { name: 'Team Vitality', tag: 'VIT', region: Region.EU },
  { name: 'Team Spirit', tag: 'TS', region: Region.CIS },
  { name: 'MOUZ', tag: 'MOUZ', region: Region.EU },
  { name: 'G2 Esports', tag: 'G2', region: Region.EU },
  { name: 'Virtus.pro', tag: 'VP', region: Region.CIS },
  { name: 'Complexity', tag: 'COL', region: Region.NA },
  { name: 'Team Liquid', tag: 'TL', region: Region.NA },
  { name: 'Cloud9', tag: 'C9', region: Region.CIS },
  { name: 'Astralis', tag: 'AST', region: Region.EU },
  { name: 'HEROIC', tag: 'HER', region: Region.EU },
  { name: 'ENCE', tag: 'ENCE', region: Region.EU },
  { name: 'Team Falcons', tag: 'FLC', region: Region.EU },
  { name: 'FURIA', tag: 'FUR', region: Region.SA },
  { name: 'NIP', tag: 'NIP', region: Region.EU },
  { name: 'BIG', tag: 'BIG', region: Region.EU },
  { name: 'Monte', tag: 'MNT', region: Region.EU },
  { name: 'GamerLegion', tag: 'GL', region: Region.EU },
  { name: 'Apeks', tag: 'APK', region: Region.EU },
  { name: 'TheMongolz', tag: 'MGLZ', region: Region.ASIA },
  { name: 'MIBR', tag: 'MIBR', region: Region.SA },
  { name: 'Imperial', tag: 'IMP', region: Region.SA },
  { name: 'paiN Gaming', tag: 'PAIN', region: Region.SA },
  { name: 'BetBoom', tag: 'BB', region: Region.CIS },
  { name: 'FORZE', tag: 'FORZE', region: Region.CIS },
  { name: 'Aurora', tag: 'AUR', region: Region.CIS },
  { name: 'SAW', tag: 'SAW', region: Region.SA },
  { name: '9z Team', tag: '9z', region: Region.SA },
  { name: 'TYLOO', tag: 'TYL', region: Region.ASIA },
  { name: 'Lynn Vision', tag: 'LVG', region: Region.ASIA },
  { name: 'Wildcard', tag: 'WC', region: Region.NA },
];

async function main() {
  console.log('🌍 Генерація Екосистеми: Старт...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const cs2Simulator = new Cs2SimulatorService();

  const admin = await prisma.user.create({
    data: {
      username: 'super_admin',
      email: 'admin@esports.com',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const game = await prisma.game.upsert({
    where: { slug: 'cs2' },
    update: {},
    create: { name: 'Counter-Strike 2', slug: 'cs2' },
  });

  // Явна типізація масивів
  const generatedTeams: Team[] = [];
  const teamsRostersMap: Record<
    string,
    {
      playerId: string;
      role: RosterRole;
      rating: number;
      inGameRole?: string;
    }[]
  > = {};

  console.log(`Створення ${realTeams.length} команд (192 користувачі)...`);

  for (let i = 0; i < realTeams.length; i++) {
    const tData = realTeams[i];
    let totalElo = 0;
    const rosterData: {
      playerId: string;
      role: RosterRole;
      rating: number;
      inGameRole?: string;
    }[] = [];

    // Капітан
    const capRating = getRandomRating(2800, 3400);
    totalElo += capRating;
    const captainUser = await prisma.user.create({
      data: {
        username: `cap_${tData.tag.toLowerCase()}`,
        email: `cap_${tData.tag}@test.com`,
        passwordHash,
      },
    });
    const captainPlayer = await prisma.player.create({
      data: {
        userId: captainUser.id,
        gameId: game.id,
        nickname: `${tData.tag}_Cap`,
        rating: capRating,
        inGameRole: 'IGL',
        stats: {
          matchesPlayed: Math.floor(Math.random() * 150) + 50,
          winRate: (45 + Math.random() * 15).toFixed(2), // 45% - 60%
          avgKills: (14 + Math.random() * 8).toFixed(1), // 14 - 22 кіла
          avgRating: (0.9 + Math.random() * 0.4).toFixed(2),
        },
      },
    });

    // Команда
    const team = await prisma.team.create({
      data: {
        name: tData.name,
        tag: tData.tag,
        captainId: captainPlayer.id,
        averageRating: 1000,
        tier: 1,
        region: tData.region,
      },
    });

    await prisma.player.update({
      where: { id: captainPlayer.id },
      data: { teamId: team.id },
    });
    rosterData.push({
      playerId: captainPlayer.id,
      role: RosterRole.CAPTAIN,
      rating: capRating,
      inGameRole: 'IGL',
    });

    const cs2Roles = ['SNIPER', 'ENTRY', 'RIFLER', 'SUPPORT'];

    // 4 Гравці
    for (let j = 1; j <= 4; j++) {
      const pRating = getRandomRating(2500, 3200);
      const playerRole = cs2Roles[j - 1];
      totalElo += pRating;
      const user = await prisma.user.create({
        data: {
          username: `p${j}_${tData.tag.toLowerCase()}`,
          email: `p${j}_${tData.tag}@test.com`,
          passwordHash,
        },
      });
      const player = await prisma.player.create({
        data: {
          userId: user.id,
          gameId: game.id,
          nickname: `${tData.tag}_Player${j}`,
          rating: pRating,
          teamId: team.id,
          inGameRole: playerRole,
          stats: {
            matchesPlayed: Math.floor(Math.random() * 150) + 50,
            winRate: (45 + Math.random() * 15).toFixed(2),
            avgKills: (14 + Math.random() * 8).toFixed(1),
            avgRating: (0.9 + Math.random() * 0.4).toFixed(2),
          },
        },
      });
      rosterData.push({
        playerId: player.id,
        role: RosterRole.PLAYER,
        rating: pRating,
        inGameRole: playerRole,
      });
    }

    // Тренер
    const coachUser = await prisma.user.create({
      data: {
        username: `coach_${tData.tag.toLowerCase()}`,
        email: `coach_${tData.tag}@test.com`,
        passwordHash,
      },
    });
    const coachPlayer = await prisma.player.create({
      data: {
        userId: coachUser.id,
        gameId: game.id,
        nickname: `${tData.tag}_Coach`,
        rating: 1500,
        teamId: team.id,
        inGameRole: 'COACH',
      },
    });
    rosterData.push({
      playerId: coachPlayer.id,
      role: RosterRole.COACH,
      rating: 1500,
      inGameRole: 'COACH',
    });

    const avgRating = Math.floor(totalElo / 5);
    const updatedTeam = await prisma.team.update({
      where: { id: team.id },
      data: {
        averageRating: avgRating,
        tier: avgRating >= 2900 ? 1 : avgRating >= 2600 ? 2 : 3,
      },
    });

    generatedTeams.push(updatedTeam);
    teamsRostersMap[team.id] = rosterData;
  }

  console.log('Генерація 3 минулих турнірів (для H2H)...');
  const pastMatches: Prisma.MatchCreateManyInput[] = [];
  const maps = [
    'Mirage',
    'Dust2',
    'Inferno',
    'Nuke',
    'Ancient',
    'Anubis',
    'Vertigo',
  ];

  for (let season = 1; season <= 3; season++) {
    const pastTournament = await prisma.tournament.create({
      data: {
        title: `IEM Global Season ${2023 + season}`,
        gameId: game.id,
        tier: 1,
        region: Region.GLOBAL,
        kFactor: 1.0,
        format: TournamentFormat.TEAM,
        settings: {
          pointsForWin: 3,
          tiebreakers: ['h2h'],
          bracketType: 'SINGLE_ELIMINATION',
        },
        status: 'finished',
        creatorId: admin.id,
      },
    });

    // Реєструємо перші 16 команд на турнір + ЗБЕРІГАЄМО ЇХНІЙ РОСТЕР
    for (let i = 0; i < 16; i++) {
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: pastTournament.id,
          teamId: generatedTeams[i].id,
          joinedStage: 'GROUP',
          seed: i + 1,
        },
      });

      const rosterToInsert = teamsRostersMap[generatedTeams[i].id].map((r) => ({
        participantId: participant.id,
        playerId: r.playerId,
        role: r.role,
      }));
      await prisma.tournamentRoster.createMany({ data: rosterToInsert });
    }

    // Генеруємо випадкові матчі
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j += 3) {
        const teamA = generatedTeams[i];
        const teamB = generatedTeams[j];

        // 1. Відфільтровуємо тренерів (вони не грають) і формуємо TeamInput для симулятора
        const activePlayersA = teamsRostersMap[teamA.id].filter(
          (p) => p.role !== 'COACH',
        );
        const activePlayersB = teamsRostersMap[teamB.id].filter(
          (p) => p.role !== 'COACH',
        );

        const teamAInput = {
          id: teamA.id,
          rating: teamA.averageRating,
          players: activePlayersA.map((p) => ({
            id: p.playerId,
            rating: p.rating,
            inGameRole: p.inGameRole,
          })),
        };

        const teamBInput = {
          id: teamB.id,
          rating: teamB.averageRating,
          players: activePlayersB.map((p) => ({
            id: p.playerId,
            rating: p.rating,
            inGameRole: p.inGameRole,
          })),
        };

        // 2. Рахуємо ймовірність
        const expectedProbA =
          teamA.averageRating / (teamA.averageRating + teamB.averageRating);

        // 3. запускаємо симулятор кс2 для отримання результату серії
        const matchResult = cs2Simulator.simulateSeries(
          teamAInput,
          teamBInput,
          expectedProbA,
          3, // BO3
          () => Math.random(), // Простий рандом замість генів
        );

        // 4. Додаємо матч у масив для Prisma
        pastMatches.push({
          id: uuidv4(),
          tournamentId: pastTournament.id,
          stage: Stage.GROUP,
          bracket: Bracket.NONE,
          round: 1,
          teamAId: teamA.id,
          teamBId: teamB.id,

          scoreA: matchResult.winsA, // Рахунок по картах
          scoreB: matchResult.winsB,
          details: { maps: matchResult.mapDetails } as Prisma.InputJsonValue,
          stats: matchResult.stats as Prisma.InputJsonValue, // загальна статистика серії

          isProcessed: true,
          playedAt: new Date(
            Date.now() - Math.floor(Math.random() * 10000000000),
          ),
        });
      }
    }
  }

  await prisma.match.createMany({ data: pastMatches });
  console.log(
    `База успішно заповнена! Згенеровано 32 команди та ${pastMatches.length} історичних матчів.`,
  );
}

main()
  .catch((e) => {
    console.error('Помилка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
