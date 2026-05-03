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
    { playerId: string; role: RosterRole }[]
  > = {};

  console.log(`👤 Створення ${realTeams.length} команд (192 користувачі)...`);

  for (let i = 0; i < realTeams.length; i++) {
    const tData = realTeams[i];
    let totalElo = 0;
    const rosterData: { playerId: string; role: RosterRole }[] = [];

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
    rosterData.push({ playerId: captainPlayer.id, role: RosterRole.CAPTAIN });

    // 4 Гравці
    for (let j = 1; j <= 4; j++) {
      const pRating = getRandomRating(2500, 3200);
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
        },
      });
      rosterData.push({ playerId: player.id, role: RosterRole.PLAYER });
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
      },
    });
    rosterData.push({ playerId: coachPlayer.id, role: RosterRole.COACH });

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

        const aIsFav = teamA.averageRating > teamB.averageRating;
        const isAWinner = Math.random() < (aIsFav ? 0.65 : 0.35);
        const scoreA = isAWinner ? 2 : Math.random() > 0.5 ? 1 : 0;
        const scoreB = isAWinner
          ? scoreA === 2 && Math.random() > 0.5
            ? 1
            : 0
          : 2;

        const totalMaps = scoreA + scoreB;

        // Явна типізація масиву карт
        const matchMaps: { map: string; scoreA: number; scoreB: number }[] = [];

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
