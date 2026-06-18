import { Injectable } from '@nestjs/common';
import {
  IMatchSimulator,
  MatchSimulationResult,
  MapResult,
  TeamInput,
  PlayerInput,
  Cs2RoleMultiplier,
} from '../match-simulator.interface';
import { Cs2PlayerStat, BaseMapStat } from '../../stats/stats.types';

@Injectable()
export class Cs2SimulatorService implements IMatchSimulator {
  private readonly AVAILABLE_MAPS = [
    'Mirage',
    'Dust2',
    'Inferno',
    'Nuke',
    'Ancient',
    'Anubis',
    'Vertigo',
  ];

  private readonly ROLE_MULTIPLIERS: Record<string, Cs2RoleMultiplier> = {
    SNIPER: { kills: 1.22, deaths: 0.8, assists: 0.5, hs_rate: 0.35 }, // Багато вбиває (AWP), рідко вмирає, мало асистів
    ENTRY: { kills: 1.15, deaths: 1.15, assists: 0.9, hs_rate: 0.55 }, // Перший іде в бій,тому багато вбиває, але часто вмирає першим
    IGL: { kills: 0.75, deaths: 1.05, assists: 1.2, hs_rate: 0.45 }, // Координує команду, фокус не на стрільбі, кидає флешки
    SUPPORT: { kills: 0.85, deaths: 1.0, assists: 1.3, hs_rate: 0.4 }, // Сапорт: розкидки, грає на допомогу
    RIFLER: { kills: 1.0, deaths: 1.0, assists: 1.0, hs_rate: 0.5 }, // Стандартний гравець (якщо роль не вказана)
  };
  private readonly OVERTIME_PROBABILITY = 0.15;
  private readonly ROUNDS_TO_WIN = 13;

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
    const mapPool = [...this.AVAILABLE_MAPS];

    const statsMaps: BaseMapStat<Cs2PlayerStat>[] = []; // Масив для зберігання статистики кожної карти
    let totalDurationMinutes = 0;

    while (winsA < mapsToWin && winsB < mapsToWin) {
      const mapGeneRoll = getGeneRoll();
      const aWinsThisMap = mapGeneRoll <= expectedProbA;

      const mapIndex = Math.floor(Math.random() * mapPool.length);
      const mapName = mapPool.splice(mapIndex, 1)[0];

      const { scoreA, scoreB } = this.simulateMapScore(aWinsThisMap);
      mapDetails.push({ map: mapName, scoreA, scoreB });

      // Орієнтовна тривалість карти (раунд ≈ 1.6 хв)
      const mapDuration = Math.floor((scoreA + scoreB) * 1.6);
      totalDurationMinutes += mapDuration;

      // Ініціалізуємо свіжу статистику для кожної карти
      const mapStatsA = this.initTeamStats(teamA);
      const mapStatsB = this.initTeamStats(teamB);

      // Генеруємо стату для кожної карти і додаємо до загальної
      this.accumulateMapStats(mapStatsA, teamA.players, scoreA, scoreB);
      this.accumulateMapStats(mapStatsB, teamB.players, scoreB, scoreA);

      statsMaps.push({
        mapName: mapName,
        durationMinutes: mapDuration,
        teamA: { score: scoreA, players: mapStatsA },
        teamB: { score: scoreB, players: mapStatsB },
      });

      if (aWinsThisMap) winsA++;
      else winsB++;
    }

    return {
      winsA,
      winsB,
      mapDetails,
      stats: {
        durationMinutes: totalDurationMinutes, // Загальна тривалість серії
        maps: statsMaps, // Масив з деталями кожної карти
      },
    };
  }

  private simulateMapScore(
    winnerIsA: boolean,
    expectedProbA: number = 0.5, // Тепер приймаємо ймовірність
  ): { scoreA: number; scoreB: number } {
    const isOvertime = Math.random() < 0.12;
    if (isOvertime) {
      const otLoser = Math.floor(Math.random() * 2) + 14;
      return winnerIsA
        ? { scoreA: 16, scoreB: otLoser }
        : { scoreA: otLoser, scoreB: 16 };
    }

    // Визначаємо ймовірність переможця
    const winnerProb = winnerIsA ? expectedProbA : 1 - expectedProbA;
    let loserScore = 0;
    const rand = Math.random();

    // Якщо переможець був явним фаворитом (> 75% шанс)
    if (winnerProb > 0.75) {
      if (rand < 0.4)
        loserScore = Math.floor(Math.random() * 4); // 0-3 (Розгром)
      else if (rand < 0.8)
        loserScore = Math.floor(Math.random() * 4) + 4; // 4-7
      else loserScore = Math.floor(Math.random() * 5) + 8; // 8-12
    }
    // Якщо команди були рівні (< 60% шанс)
    else if (winnerProb < 0.6) {
      if (rand < 0.1)
        loserScore = Math.floor(Math.random() * 4) + 4; // 4-7 (Рідкісний розгром)
      else loserScore = Math.floor(Math.random() * 5) + 8; // 8-12 (Зазвичай щільна гра)
    }
    // Стандартний розподіл
    else {
      if (rand < 0.15) loserScore = Math.floor(Math.random() * 4);
      else if (rand < 0.45) loserScore = Math.floor(Math.random() * 4) + 4;
      else loserScore = Math.floor(Math.random() * 5) + 8;
    }

    return winnerIsA
      ? { scoreA: 13, scoreB: loserScore }
      : { scoreA: loserScore, scoreB: 13 };
  }

  private initTeamStats(team: TeamInput): Cs2PlayerStat[] {
    return team.players.map((participant) => ({
      playerId: participant.id,
      rating: participant.rating,
      kills: 0,
      deaths: 0,
      damage: 0,
      assists: 0,
      headshots: 0,
      adr: 0,
      roundsPlayed: 0,
    }));
  }

  private accumulateMapStats(
    teamStats: Cs2PlayerStat[],
    players: PlayerInput[],
    roundsWon: number,
    roundsLost: number,
  ) {
    // Фіксовані пули для команди
    const targetKills = Math.round(roundsWon * 4.3 + roundsLost * 1.8);
    const targetDeaths = Math.round(roundsWon * 1.8 + roundsLost * 4.3);

    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    const fallbackRoles = ['SNIPER', 'RIFLER', 'ENTRY', 'SUPPORT', 'IGL'];

    // Рахуємо "вагу" кожного гравця для кілів і смертей
    const playersTemp = players.map((participant) => {
      const dailyForm = Math.random() * 0.3 + 0.85;
      let role = participant.inGameRole;
      if (!role || !this.ROLE_MULTIPLIERS[role]) {
        const index = sortedPlayers.findIndex((sp) => sp.id === participant.id);
        role = fallbackRoles[index] || 'RIFLER';
      }

      const effectiveRating = Math.pow(participant.rating * dailyForm, 0.8);
      const mult = this.ROLE_MULTIPLIERS[role];

      return {
        id: participant.id,
        role,
        // Вага кілів: залежить від рейтингу та ролі
        weightK: effectiveRating * mult.kills,
        // Вага смертей: залежить від ролі. Гравці з меншим рейтингом вмирають трохи частіше
        weightD: mult.deaths * (1000 / effectiveRating),
        assistsMult: mult.assists,
        hsRate: mult.hs_rate,
      };
    });

    const sumWeightK = playersTemp.reduce((acc, p) => acc + p.weightK, 0);
    const sumWeightD = playersTemp.reduce((acc, p) => acc + p.weightD, 0);

    let currentKills = 0;
    let currentDeaths = 0;

    // Розподіляємо пули з точністю до 1
    playersTemp.forEach((p, i) => {
      const statIndex = teamStats.findIndex((s) => s.playerId === p.id);
      if (statIndex === -1) return;

      let kills = Math.round((p.weightK / sumWeightK) * targetKills);
      let deaths = Math.round((p.weightD / sumWeightD) * targetDeaths);

      // Останній гравець забирає залишок від округлення, щоб сума була ідеальною
      if (i === playersTemp.length - 1) {
        kills = targetKills - currentKills;
        deaths = targetDeaths - currentDeaths;
      }
      currentKills += kills;
      currentDeaths += deaths;

      const assists = Math.round(targetKills * 0.2 * p.assistsMult);
      const totalRounds = roundsWon + roundsLost;
      const nonKillDamage =
        Math.floor(Math.random() * 17 * totalRounds) + totalRounds * 8;
      // Урон за кіл зменшено зі 105 до 95, щоб компенсувати додавання базової нелетальної шкоди
      const totalDamage = kills * 95 + assists * 45 + nonKillDamage;

      teamStats[statIndex].kills += Math.max(0, kills);
      teamStats[statIndex].deaths += Math.max(0, deaths);
      teamStats[statIndex].assists += Math.max(0, assists);
      teamStats[statIndex].damage += Math.round(totalDamage);
      teamStats[statIndex].headshots += Math.floor(
        Math.max(0, kills) * (p.hsRate + (Math.random() * 0.1 - 0.05)),
      );
      teamStats[statIndex].adr = Math.floor(
        teamStats[statIndex].damage / totalRounds,
      );
      teamStats[statIndex].roundsPlayed += totalRounds;
    });
  }
}
