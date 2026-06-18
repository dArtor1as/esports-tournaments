import { Injectable } from '@nestjs/common';
import {
  IMatchSimulator,
  MatchSimulationResult,
  MapResult,
  TeamInput,
  PlayerInput,
  Dota2RoleMultiplier,
} from '../match-simulator.interface';
import { Dota2PlayerStat, BaseMapStat } from '../../stats/stats.types';

@Injectable()
export class Dota2SimulatorService implements IMatchSimulator {
  private readonly ROLE_MULTIPLIERS: Record<string, Dota2RoleMultiplier> = {
    POS_1: { gpm: 1.4, kills: 1.3, deaths: 0.8, assists: 0.7 }, // Кері фармить і вбиває, мало вмирає
    POS_2: { gpm: 1.25, kills: 1.45, deaths: 0.95, assists: 1.0 }, // Мідер найчастіше бере участь у бійках
    POS_3: { gpm: 1.05, kills: 1.15, deaths: 1.05, assists: 1.3 }, // Офлейнер ініціює (більше смертей і асистів)
    POS_4: { gpm: 0.8, kills: 0.55, deaths: 1.25, assists: 1.6 }, // Сапорт-роумер
    POS_5: { gpm: 0.6, kills: 0.4, deaths: 1.5, assists: 1.9 }, // Хард-сапорт: бідний, вмирає за команду, купа асистів
  };

  simulateSeries(
    teamA: TeamInput,
    teamB: TeamInput,
    expectedProbA: number,
    bestOf: number = 3,
    getGeneRoll: () => number,
  ): MatchSimulationResult {
    const mapsToWin = Math.ceil(bestOf / 2);
    let winsA = 0;
    let winsB = 0;
    const mapDetails: MapResult[] = [];

    const statsMaps: BaseMapStat<Dota2PlayerStat>[] = []; // Масив ігор (карт)

    let totalDurationMinutes = 0;

    let gameNumber = 1;
    while (winsA < mapsToWin && winsB < mapsToWin) {
      const mapGeneRoll = getGeneRoll();
      const aWinsThisMap = mapGeneRoll <= expectedProbA;

      const durationMinutes = Math.floor(Math.random() * 25) + 30; // 30 - 55 хв
      totalDurationMinutes += durationMinutes;
      // Рахуємо рахунок гри залежно від сили команди
      const { scoreA, scoreB } = this.simulateGameScore(
        aWinsThisMap,
        expectedProbA,
        durationMinutes,
      );

      mapDetails.push({ map: `Game ${gameNumber}`, scoreA, scoreB });

      const mapStatsA = this.initTeamStats(teamA);
      const mapStatsB = this.initTeamStats(teamB);

      this.accumulateDotaStats(
        mapStatsA,
        teamA.players,
        durationMinutes,
        scoreA, // teamKills
        scoreB, // teamDeaths
        aWinsThisMap,
      );
      this.accumulateDotaStats(
        mapStatsB,
        teamB.players,
        durationMinutes,
        scoreB, // teamKills
        scoreA, // teamDeaths
        !aWinsThisMap,
      );

      statsMaps.push({
        mapName: `Game ${gameNumber}`,
        durationMinutes,
        teamA: { score: scoreA, players: mapStatsA },
        teamB: { score: scoreB, players: mapStatsB },
      });

      if (aWinsThisMap) winsA++;
      else winsB++;
      gameNumber++;
    }

    return {
      winsA,
      winsB,
      mapDetails,
      stats: {
        durationMinutes: totalDurationMinutes,
        maps: statsMaps,
      },
    };
  }

  // Залежність рахунку від сили команди
  private simulateGameScore(
    winnerIsA: boolean,
    expectedProbA: number,
    durationMinutes: number,
  ): { scoreA: number; scoreB: number } {
    const winnerProb = winnerIsA ? expectedProbA : 1 - expectedProbA;
    const rand = Math.random();

    let winnerKpm = 0; // Кіли за хвилину для переможця
    let loserKpm = 0; // Кіли за хвилину для переможеного

    if (winnerProb > 0.75) {
      // Розгром (фаворит швидко і сильно душить)
      winnerKpm = 0.9 + rand * 0.3; // 0.9 - 1.2
      loserKpm = 0.2 + rand * 0.2; // 0.2 - 0.4
    } else if (winnerProb < 0.6) {
      // Рівний матч (багато бійок з обох сторін)
      winnerKpm = 0.7 + rand * 0.2; // 0.7 - 0.9
      loserKpm = 0.5 + rand * 0.3; // 0.5 - 0.8
    } else {
      // Стандартний матч
      winnerKpm = 0.8 + rand * 0.2; // 0.8 - 1.0
      loserKpm = 0.35 + rand * 0.25; // 0.35 - 0.60
    }

    const winnerKills = Math.floor(durationMinutes * winnerKpm);
    const loserKills = Math.floor(durationMinutes * loserKpm);

    return winnerIsA
      ? { scoreA: winnerKills, scoreB: loserKills }
      : { scoreA: loserKills, scoreB: winnerKills };
  }

  private initTeamStats(team: TeamInput): Dota2PlayerStat[] {
    return team.players.map((participant) => ({
      playerId: participant.id,
      rating: participant.rating,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      gpm: 0,
      xpm: 0,
      netWorth: 0,
    }));
  }

  private accumulateDotaStats(
    teamStats: Dota2PlayerStat[],
    players: PlayerInput[],
    durationMinutes: number,
    teamKills: number,
    teamDeaths: number,
    isWinner: boolean,
  ) {
    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    const fallbackRoles = ['POS_1', 'POS_2', 'POS_3', 'POS_4', 'POS_5'];

    // 1. Рахуємо вагу кожного гравця
    const playersTemp = players.map((participant) => {
      const dailyForm = Math.random() * 0.15 + 0.925;
      let role = participant.inGameRole;

      if (!role || !this.ROLE_MULTIPLIERS[role]) {
        const index = sortedPlayers.findIndex((sp) => sp.id === participant.id);
        role = fallbackRoles[index] || 'POS_5';
      }

      const effectiveRating = Math.pow(participant.rating * dailyForm, 0.9);
      const mult = this.ROLE_MULTIPLIERS[role];

      return {
        id: participant.id,
        role,
        weightK: effectiveRating * mult.kills,
        weightD: mult.deaths * (1000 / effectiveRating),
        weightA: mult.assists,
        multGpm: mult.gpm,
      };
    });

    const sumWeightK = playersTemp.reduce((acc, p) => acc + p.weightK, 0);
    const sumWeightD = playersTemp.reduce((acc, p) => acc + p.weightD, 0);
    const sumWeightA = playersTemp.reduce((acc, p) => acc + p.weightA, 0);

    let currentKills = 0;
    let currentDeaths = 0;
    let currentAssists = 0;

    // У Доті в середньому 1 кіл = 1.8-2.5 асистів
    const targetAssists = Math.floor(teamKills * (1.8 + Math.random() * 0.7));

    // 2. Розподіляємо пули
    playersTemp.forEach((p, i) => {
      const statIndex = teamStats.findIndex((s) => s.playerId === p.id);
      if (statIndex === -1) return;

      let kills = Math.round((p.weightK / sumWeightK) * teamKills);
      let deaths = Math.round((p.weightD / sumWeightD) * teamDeaths);
      let assists = Math.round((p.weightA / sumWeightA) * targetAssists);

      // Коригування залишків для останнього гравця
      if (i === playersTemp.length - 1) {
        kills = teamKills - currentKills;
        deaths = teamDeaths - currentDeaths;
        assists = targetAssists - currentAssists;
      }

      currentKills += kills;
      currentDeaths += deaths;
      currentAssists += assists;

      // Урон = участь у вбивствах + базова шкода в хвилину за роль
      const damagePerMin = p.role === 'POS_1' || p.role === 'POS_2' ? 650 : 300;
      const damage = Math.floor(
        kills * 1100 +
          assists * 600 +
          durationMinutes * damagePerMin * (0.8 + Math.random() * 0.4),
      );

      const baseGpm = isWinner ? 550 : 350;
      const gpm = Math.floor((baseGpm + (Math.random() * 80 - 40)) * p.multGpm);
      const netWorth = gpm * durationMinutes;

      teamStats[statIndex].kills += Math.max(0, kills);
      teamStats[statIndex].deaths += Math.max(0, deaths);
      teamStats[statIndex].assists += Math.max(0, assists);
      teamStats[statIndex].damage += Math.max(0, damage);
      teamStats[statIndex].gpm = gpm;
      teamStats[statIndex].xpm = Math.floor(gpm * 1.15); // XPM зазвичай трохи вищий за GPM
      teamStats[statIndex].netWorth = netWorth;
    });
  }
}
