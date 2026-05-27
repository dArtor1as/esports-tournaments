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
    POS_2: { gpm: 1.25, kills: 1.45, deaths: 1.0, assists: 1.0 }, // Мідер найчастіше бере участь у бійках
    POS_3: { gpm: 1.0, kills: 0.9, deaths: 1.2, assists: 1.3 }, // Офлейнер ініціює (більше смертей і асистів)
    POS_4: { gpm: 0.8, kills: 0.7, deaths: 1.3, assists: 1.6 }, // Сапорт-роумер
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

      // В Доті рахунок (score) - це кіли команди.
      // Приблизно 0.8 кіла в хвилину для переможця, 0.4 для лузера
      const winnerKills = Math.floor(
        durationMinutes * (0.8 + Math.random() * 0.4),
      );
      const loserKills = Math.floor(
        durationMinutes * (0.3 + Math.random() * 0.3),
      );

      const scoreA = aWinsThisMap ? winnerKills : loserKills;
      const scoreB = aWinsThisMap ? loserKills : winnerKills;

      mapDetails.push({ map: `Game ${gameNumber}`, scoreA, scoreB });

      const mapStatsA = this.initTeamStats(teamA);
      const mapStatsB = this.initTeamStats(teamB);

      this.accumulateDotaStats(
        mapStatsA,
        teamA.players,
        durationMinutes,
        aWinsThisMap,
      );
      this.accumulateDotaStats(
        mapStatsB,
        teamB.players,
        durationMinutes,
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
    isWinner: boolean,
  ) {
    const totalKills = Math.floor(durationMinutes * (isWinner ? 0.9 : 0.4));

    // 1. Смарт-розподіл ролей (Fallback).
    // Якщо ролі в БД не вказані, автоматично роздаємо їх по рейтингу
    // (найбільший рейтинг = POS_1, найменший = POS_5)
    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    const fallbackRoles = ['POS_1', 'POS_2', 'POS_3', 'POS_4', 'POS_5'];

    const playersWithForm = players.map((participant) => {
      const dailyForm = Math.random() * 0.6 + 0.7;
      const playerRating =
        teamStats.find((s) => s.playerId === participant.id)?.rating || 1000;

      // Визначаємо роль: або з БД, або фолбек
      let role = participant.inGameRole;
      if (!role || !this.ROLE_MULTIPLIERS[role]) {
        const index = sortedPlayers.findIndex((sp) => sp.id === participant.id);
        role = fallbackRoles[index] || 'POS_5';
      }

      const effectiveRating = Math.pow(playerRating * dailyForm, 1.2);
      return { id: participant.id, effectiveRating, role };
    });

    // 2. Рахуємо сумарний рейтинг для пропорцій (як і раніше)
    const totalEffective = playersWithForm.reduce(
      (sum, participant) => sum + participant.effectiveRating,
      0,
    );

    // 3. Застосовуємо множники
    playersWithForm.forEach((playerForm) => {
      const statIndex = teamStats.findIndex(
        (s) => s.playerId === playerForm.id,
      );
      if (statIndex === -1) return;

      const multipliers =
        this.ROLE_MULTIPLIERS[playerForm.role] ||
        this.ROLE_MULTIPLIERS['POS_3'];
      const share = playerForm.effectiveRating / totalEffective;

      // КІЛИ: Базова частка * Множник ролі
      let kills = Math.round(totalKills * share * multipliers.kills);
      kills += Math.floor(Math.random() * 3) - 1;
      if (kills < 0) kills = 0;

      // СМЕРТІ: Залежать від ролі (сапорти вмирають частіше)
      const baseDeaths = Math.floor(Math.random() * 8) + (isWinner ? 2 : 6);
      const deaths = Math.floor(baseDeaths * multipliers.deaths);

      // АСИСТИ: Сапорти отримують буст
      const baseAssists = Math.floor(totalKills * 0.4 * Math.random()) + 4;
      const assists = Math.floor(baseAssists * multipliers.assists);
      // Шкода: Кіли + Асисти + Рандом
      const baseDamage = kills * 1200 + assists * 700 + Math.random() * 5000;
      const damage = Math.floor(baseDamage * multipliers.kills);

      // GPM / XPM: Жорстка прив'язка до ролі
      const baseGpm = isWinner ? 550 : 350;
      // Додаємо рандом, але рольовий множник вирішує все
      const gpm = Math.floor((baseGpm + Math.random() * 100) * multipliers.gpm);

      const netWorth = gpm * durationMinutes;

      teamStats[statIndex].kills += kills;
      teamStats[statIndex].deaths += deaths;
      teamStats[statIndex].assists += assists;
      teamStats[statIndex].damage += damage;
      teamStats[statIndex].gpm = gpm;
      teamStats[statIndex].xpm = Math.floor(gpm * 1.1);
      teamStats[statIndex].netWorth = netWorth;
    });
  }
}
