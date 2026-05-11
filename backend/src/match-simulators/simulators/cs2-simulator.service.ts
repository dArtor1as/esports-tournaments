import { Injectable } from '@nestjs/common';
import {
  IMatchSimulator,
  MatchSimulationResult,
  MapResult,
  TeamInput,
  PlayerInput,
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

  private readonly ROLE_MULTIPLIERS = {
    SNIPER: { kills: 1.25, deaths: 0.7, assists: 0.5, hs_rate: 0.3 }, // Багато вбиває (AWP), рідко вмирає, мало асистів
    ENTRY: { kills: 1.1, deaths: 1.3, assists: 1.0, hs_rate: 0.55 }, // Перший іде в бій,тому багато вбиває, але часто вмирає першим
    IGL: { kills: 0.8, deaths: 1.05, assists: 1.3, hs_rate: 0.45 }, // Координує команду, фокус не на стрільбі, кидає флешки
    SUPPORT: { kills: 0.9, deaths: 1.0, assists: 1.4, hs_rate: 0.4 }, // Сапорт: розкидки, грає на допомогу
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

  private simulateMapScore(winnerIsA: boolean): {
    scoreA: number;
    scoreB: number;
  } {
    const isOvertime = Math.random() < this.OVERTIME_PROBABILITY;
    const winnerScore = isOvertime ? 16 : this.ROUNDS_TO_WIN;
    const loserScore = isOvertime
      ? Math.floor(Math.random() * 2) + 14
      : Math.floor(Math.random() * (this.ROUNDS_TO_WIN - 1));

    return winnerIsA
      ? { scoreA: winnerScore, scoreB: loserScore }
      : { scoreA: loserScore, scoreB: winnerScore };
  }

  private initTeamStats(team: TeamInput): Cs2PlayerStat[] {
    return team.players.map((p) => ({
      playerId: p.id,
      rating: p.rating,
      kills: 0,
      deaths: 0,
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
    // За кожен виграний раунд команда робить ~4.2 кіла. За програний ~1.5 кіла.
    const expectedKillsForWins = roundsWon * 4.2;
    const expectedKillsForLosses = roundsLost * 1.5;
    const mapTotalKills = Math.floor(
      expectedKillsForWins + expectedKillsForLosses,
    );

    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    const fallbackRoles = ['SNIPER', 'RIFLER', 'ENTRY', 'SUPPORT', 'IGL'];

    // Рахуємо "Щоденну форму"
    const playersWithForm = players.map((p) => {
      const dailyForm = Math.random() * 0.6 + 0.7;

      let role = p.inGameRole;
      if (!role || !this.ROLE_MULTIPLIERS[role]) {
        const index = sortedPlayers.findIndex((sp) => sp.id === p.id);
        role = fallbackRoles[index] || 'RIFLER';
      }

      const effectiveRating = Math.pow(p.rating * dailyForm, 1.2);
      return { id: p.id, effectiveRating, role };
    });
    const totalEffective = playersWithForm.reduce(
      (sum, p) => sum + p.effectiveRating,
      0,
    );

    playersWithForm.forEach((pf) => {
      const statIndex = teamStats.findIndex((s) => s.playerId === pf.id);
      if (statIndex === -1) return;

      const multipliers = this.ROLE_MULTIPLIERS[pf.role];
      const share = pf.effectiveRating / totalEffective;
      // Застосовуємо множники ролі
      let kills = Math.round(mapTotalKills * share * multipliers.kills);
      kills += Math.floor(Math.random() * 5) - 2;
      if (kills < 0) kills = 0;

      const baseDeaths = roundsLost * 0.8 + roundsWon * 0.3;
      const deaths = Math.floor(
        (baseDeaths + Math.random() * 6 - 2) * multipliers.deaths,
      );
      const baseAssists = Math.floor(Math.random() * 6) + 2;
      const assists = Math.floor(baseAssists * multipliers.assists);

      // Рахуємо ADR (Average Damage per Round)
      // 1 кіл ~ 100 урону. 1 асист ~ 45 урону. Додаємо рандомний урон без вбивств.
      const totalDamage = kills * 105 + assists * 45 + Math.random() * 250;
      const totalRounds = roundsWon + roundsLost;
      const adr = Math.floor(totalDamage / totalRounds);

      // Рахуємо Хедшоти з урахуванням ролі (снайпери б'ють у тіло)
      const hsPercentage = multipliers.hs_rate + (Math.random() * 0.1 - 0.05);
      const headshots = Math.floor(kills * hsPercentage);

      teamStats[statIndex].kills = kills;
      teamStats[statIndex].deaths = deaths;
      teamStats[statIndex].assists = assists;
      teamStats[statIndex].headshots = headshots;
      teamStats[statIndex].adr = adr;
      teamStats[statIndex].roundsPlayed = totalRounds;
    });
  }
}
