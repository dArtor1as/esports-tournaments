import {
  PrismaClient,
  Region,
  TournamentFormat,
  RosterRole,
  Stage,
  Bracket,
  Prisma,
  Team,
  User,
  Game,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Імпорти сервісів (зверни увагу на змінені шляхи ../../)
import { Cs2SimulatorService } from '../../src/match-simulators/simulators/cs2-simulator.service';
import { TeamsService } from '../../src/teams/teams.service';
import { PlayersService } from '../../src/players/players.service';
import { StatsService } from '../../src/stats/stats.service';
import { PlayerStatsAggregatorService } from '../../src/stats/player-stats-aggregator.service';
import { EloCalculatorService } from '../../src/stats/elo-calculator.service';
import { AccessPolicyService } from '../../src/auth/access-policy.service';

const getRandomRating = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomBirthDate = () => {
  const start = new Date(1995, 0, 1).getTime();
  const end = new Date(2005, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
};

// Список реальних команд для CS2
const cs2TeamsData = [
  { name: 'Natus Vincere', tag: 'NAVI', region: Region.EU, countryCode: 'UA' },
  { name: 'FaZe Clan', tag: 'FaZe', region: Region.EU, countryCode: 'DE' },
  { name: 'Team Vitality', tag: 'VIT', region: Region.EU, countryCode: 'FR' },
  { name: 'Eternal Fire', tag: 'EF', region: Region.CIS, countryCode: 'TR' },
  { name: 'MOUZ', tag: 'MOUZ', region: Region.EU, countryCode: 'SE' },
  { name: 'G2 Esports', tag: 'G2', region: Region.EU, countryCode: 'DE' },
  { name: 'Fnatic', tag: 'FN', region: Region.EU, countryCode: 'UA' },
  { name: 'Complexity', tag: 'COL', region: Region.NA, countryCode: 'US' },
  { name: 'Team Liquid', tag: 'TL', region: Region.NA, countryCode: 'US' },
  { name: 'Cloud9', tag: 'C9', region: Region.NA, countryCode: 'US' },
  { name: 'Astralis', tag: 'AST', region: Region.EU, countryCode: 'DK' },
  { name: 'HEROIC', tag: 'HER', region: Region.EU, countryCode: 'NO' },
  { name: 'ENCE', tag: 'ENCE', region: Region.EU, countryCode: 'FR' },
  { name: 'Team Falcons', tag: 'FLC', region: Region.EU, countryCode: 'GB' },
  { name: 'FURIA', tag: 'FUR', region: Region.SA, countryCode: 'BR' },
  { name: 'NIP', tag: 'NIP', region: Region.EU, countryCode: 'SE' },
  { name: 'BIG', tag: 'BIG', region: Region.EU, countryCode: 'DE' },
  { name: 'Monte', tag: 'MNT', region: Region.EU, countryCode: 'UA' },
  { name: 'GamerLegion', tag: 'GL', region: Region.EU, countryCode: 'GB' },
  { name: 'Apeks', tag: 'APK', region: Region.EU, countryCode: 'UA' },
  { name: 'TheMongolz', tag: 'MGLZ', region: Region.ASIA, countryCode: 'CN' },
  { name: 'MIBR', tag: 'MIBR', region: Region.SA, countryCode: 'BR' },
  { name: 'Imperial', tag: 'IMP', region: Region.SA, countryCode: 'BR' },
  { name: 'paiN Gaming', tag: 'PAIN', region: Region.SA, countryCode: 'BR' },
  { name: 'BC Game', tag: 'BCG', region: Region.EU, countryCode: 'SE' },
  { name: 'B8', tag: 'B8', region: Region.EU, countryCode: 'UA' },
  { name: 'Aurora', tag: 'AUR', region: Region.CIS, countryCode: 'TR' },
  { name: 'SAW', tag: 'SAW', region: Region.SA, countryCode: 'BR' },
  { name: '9z Team', tag: '9z', region: Region.SA, countryCode: 'BR' },
  { name: 'TYLOO', tag: 'TYL', region: Region.ASIA, countryCode: 'CN' },
  { name: 'Lynn Vision', tag: 'LVG', region: Region.ASIA, countryCode: 'CN' },
  { name: 'Wildcard', tag: 'WC', region: Region.NA, countryCode: 'US' },
];

export async function seedCS2(prisma: PrismaClient, admin: User, game: Game) {
  console.log(' Починаємо генерацію екосистеми CS2...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // ІДЕМПОТЕНТНІСТЬ: Перевіряємо, чи вже існують команди для цієї гри
  const existingTeamsCount = await prisma.team.count({
    where: { gameId: game.id },
  });
  if (existingTeamsCount > 0) {
    console.log(
      `✅ Екосистема ${game.name} вже існує. Пропускаємо сідінг, щоб уникнути конфліктів.`,
    );
    return;
  }

  // Ініціалізуємо сервіси
  const cs2Simulator = new Cs2SimulatorService();
  const dummyCache = {
    get: async () => null,
    set: async () => {},
    del: async () => {},
  } as any;
  const accessPolicy = new AccessPolicyService();
  const teamsService = new TeamsService(
    prisma as any,
    accessPolicy,
    dummyCache,
  );
  const playersService = new PlayersService(prisma as any, dummyCache);
  const eloCalculator = new EloCalculatorService();
  const statsAggregator = new PlayerStatsAggregatorService();
  const statsService = new StatsService(
    prisma as any,
    teamsService,
    playersService,
    eloCalculator,
    statsAggregator,
    accessPolicy,
  );

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

  console.log(`Створення ${cs2TeamsData.length} команд для CS2...`);

  // 1. СТВОРЕННЯ КОМАНД І ГРАВЦІВ
  for (let i = 0; i < cs2TeamsData.length; i++) {
    const tData = cs2TeamsData[i];
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

    // Унікальна пошта та юзернейм з використанням game.slug
    const capUsername = `cap_${tData.tag.toLowerCase()}_${game.slug}`;
    const capEmail = `${capUsername}@test.com`;

    const captainUser = await prisma.user.create({
      data: {
        username: capUsername,
        email: capEmail,
        passwordHash,
        birthDate: getRandomBirthDate(),
        countryCode: tData.countryCode,
      },
    });
    const captainPlayer = await prisma.player.create({
      data: {
        userId: captainUser.id,
        gameId: game.id,
        nickname: `${tData.tag}_Cap`,
        rating: capRating,
        inGameRole: 'IGL',
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
        countryCode: tData.countryCode,
        gameId: game.id,
        isComplete: true,
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

      const pUsername = `p${j}_${tData.tag.toLowerCase()}_${game.slug}`;
      const pEmail = `${pUsername}@test.com`;

      const user = await prisma.user.create({
        data: {
          username: pUsername,
          email: pEmail,
          passwordHash,
          birthDate: getRandomBirthDate(),
          countryCode: tData.countryCode,
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
    const coachUsername = `coach_${tData.tag.toLowerCase()}_${game.slug}`;
    const coachEmail = `${coachUsername}@test.com`;

    const coachUser = await prisma.user.create({
      data: {
        username: coachUsername,
        email: coachEmail,
        passwordHash,
        birthDate: getRandomBirthDate(),
        countryCode: tData.countryCode,
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
        tier: avgRating >= 2700 ? 1 : avgRating >= 1800 ? 2 : 3,
      },
    });

    generatedTeams.push(updatedTeam);
    teamsRostersMap[team.id] = rosterData;
  }

  // Якщо команд менше 16, немає сенсу симулювати турніри
  if (generatedTeams.length < 16) {
    console.log(
      ` Недостатньо команд для симуляції турнірів ${game.name} (потрібно 16, є ${generatedTeams.length}).`,
    );
    return;
  }

  // 2. ГЕНЕРАЦІЯ МИНУЛИХ ТУРНІРІВ (СЕЗОНИ)
  console.log(' Генерація 3 минулих турнірів CS2 (для статистики)...');

  for (let season = 1; season <= 3; season++) {
    const pastMatches: Prisma.MatchCreateManyInput[] = [];

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

    let selectedTeams;
    if (season === 1) {
      selectedTeams = generatedTeams.slice(0, 16);
    } else if (season === 2) {
      selectedTeams = generatedTeams.slice(16, 32);
    } else {
      const shuffledTeams = [...generatedTeams].sort(() => 0.5 - Math.random());
      selectedTeams = shuffledTeams.slice(0, 16);
    }

    // Реєстрація команд
    for (let i = 0; i < 16; i++) {
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: pastTournament.id,
          teamId: selectedTeams[i].id,
          joinedStage: 'GROUP',
          seed: i + 1,
        },
      });

      const rosterToInsert = teamsRostersMap[selectedTeams[i].id].map((r) => ({
        participantId: participant.id,
        playerId: r.playerId,
        role: r.role,
      }));
      await prisma.tournamentRoster.createMany({ data: rosterToInsert });
    }

    let currentRoundTeams = [...selectedTeams];
    let currentRound = 1;

    // Генерація матчів плей-оф
    while (currentRoundTeams.length > 1) {
      const nextRoundTeams: Team[] = [];

      for (let i = 0; i < currentRoundTeams.length; i += 2) {
        const teamA = currentRoundTeams[i];
        const teamB = currentRoundTeams[i + 1];

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

        const expectedProbA =
          teamA.averageRating / (teamA.averageRating + teamB.averageRating);

        const matchResult = cs2Simulator.simulateSeries(
          teamAInput,
          teamBInput,
          expectedProbA,
          3, // BO3
          () => Math.random(),
        );

        const isAWinner = matchResult.winsA > matchResult.winsB;
        nextRoundTeams.push(isAWinner ? teamA : teamB);

        const isFinal = currentRoundTeams.length === 2;

        pastMatches.push({
          id: uuidv4(),
          tournamentId: pastTournament.id,
          stage: Stage.PLAYOFF,
          bracket: isFinal ? Bracket.GRAND_FINAL : Bracket.UPPER,
          round: currentRound,
          teamAId: teamA.id,
          teamBId: teamB.id,
          scoreA: matchResult.winsA,
          scoreB: matchResult.winsB,
          details: { maps: matchResult.mapDetails } as Prisma.InputJsonValue,
          stats: matchResult.stats as Prisma.InputJsonValue,
          isProcessed: true,
          playedAt: new Date(
            Date.now() - Math.floor(Math.random() * 10000000000),
          ),
        });
      }

      currentRoundTeams = nextRoundTeams;
      currentRound++;
    }

    await prisma.match.createMany({ data: pastMatches });

    console.log(`Обробка статистики та Elo для сезону ${season} CS2...`);
    await statsService.processTournamentStats(pastTournament.id);
  }
}
