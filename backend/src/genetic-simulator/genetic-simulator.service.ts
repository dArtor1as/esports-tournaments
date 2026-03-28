import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';

interface SimulationMatch {
  id: string;
  round: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  nextMatchWinnerId: string | null;
  details?: any;
}

interface Individual {
  genes: number[];
  fitness: number;
  bracket: SimulationMatch[];
}

interface MapDetail {
  map: string;
  scoreA: number;
  scoreB: number;
}

@Injectable()
export class GeneticSimulatorService {
  constructor(private prisma: PrismaService) {}

  // 1. Базова ймовірність (Elo)
  private getExpectedWinProbability(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  // 2. Обчислення модифікаторів на основі історії
  private applyHistoricalModifiers(
    probA: number,
    teamAId: string,
    teamBId: string,
    pastMatches: any[],
  ): number {
    let h2hBonus = 0;
    let formBonusA = 0;
    let formBonusB = 0;

    //  Аналіз H2H (Очні зустрічі)
    const h2hMatches = pastMatches.filter(
      (m) =>
        (m.teamAId === teamAId && m.teamBId === teamBId) ||
        (m.teamAId === teamBId && m.teamBId === teamAId),
    );

    if (h2hMatches.length > 0) {
      let winsA = 0;
      h2hMatches.forEach((m) => {
        if (m.teamAId === teamAId && m.scoreA > m.scoreB) winsA++;
        if (m.teamBId === teamAId && m.scoreB > m.scoreA) winsA++;
      });
      const winrateA = winsA / h2hMatches.length;
      // Відхилення від 50%. Максимальний бонус: 0.05 (5%)
      h2hBonus = (winrateA - 0.5) * 0.1;
    }

    //  Аналіз Загальної Форми (Вінрейт команди)
    const calcForm = (teamId: string) => {
      const teamMatches = pastMatches.filter(
        (m) => m.teamAId === teamId || m.teamBId === teamId,
      );
      if (teamMatches.length === 0) return 0;
      let wins = 0;
      teamMatches.forEach((m) => {
        if (m.teamAId === teamId && m.scoreA > m.scoreB) wins++;
        if (m.teamBId === teamId && m.scoreB > m.scoreA) wins++;
      });
      // Максимальний вплив форми: 0.025 (2.5%)
      return (wins / teamMatches.length - 0.5) * 0.05;
    };

    formBonusA = calcForm(teamAId);
    formBonusB = calcForm(teamBId);

    // Застосовуємо всі модифікатори
    let finalProb = probA + h2hBonus + formBonusA - formBonusB;

    // Захист від виходу за межі (ймовірність завжди від 1% до 99%)
    return Math.max(0.01, Math.min(0.99, finalProb));
  }

  // 3. Симуляція рахунку CS2
  private simulateCS2Map(winnerIsA: boolean): {
    scoreA: number;
    scoreB: number;
  } {
    const isOvertime = Math.random() < 0.15;
    let winnerScore = isOvertime ? 16 : 13;
    let loserScore = isOvertime
      ? Math.floor(Math.random() * 2) + 14
      : Math.floor(Math.random() * 12);

    return winnerIsA
      ? { scoreA: winnerScore, scoreB: loserScore }
      : { scoreA: loserScore, scoreB: winnerScore };
  }

  // 4. Оцінка хромосоми для single elimination
  private evaluateIndividual(
    genes: number[],
    baseSkeleton: SimulationMatch[],
    teamRatings: Record<string, number>,
    pastMatches: any[], // Передаємо історію в оцінку
  ): Individual {
    const bracket: SimulationMatch[] = JSON.parse(JSON.stringify(baseSkeleton));
    let fitness = 0;
    let currentGeneIndex = 0;

    for (let i = 0; i < bracket.length; i++) {
      const match = bracket[i];
      if (!match.teamAId || !match.teamBId) continue;

      const ratingA = teamRatings[match.teamAId];
      const ratingB = teamRatings[match.teamBId];

      // БАЗОВА ЙМОВІРНІСТЬ
      const baseProbA = this.getExpectedWinProbability(ratingA, ratingB);

      // ВРАХУВАННЯ ІСТОРІЇ
      const expectedProbA = this.applyHistoricalModifiers(
        baseProbA,
        match.teamAId,
        match.teamBId,
        pastMatches,
      );

      const availableMaps = [
        'Mirage',
        'Dust2',
        'Inferno',
        'Nuke',
        'Ancient',
        'Anubis',
        'Vertigo',
      ];
      const mapDetails: { map: string; scoreA: number; scoreB: number }[] = [];

      let winsA = 0;
      let winsB = 0;

      while (winsA < 2 && winsB < 2) {
        const mapGeneRoll =
          currentGeneIndex < genes.length
            ? genes[currentGeneIndex++]
            : Math.random();

        // Використовуємо ймовірність З УРАХУВАННЯМ ІСТОРІЇ
        const aWinsThisMap = mapGeneRoll <= expectedProbA;
        const mapName = availableMaps.splice(
          Math.floor(Math.random() * availableMaps.length),
          1,
        )[0];

        const { scoreA, scoreB } = this.simulateCS2Map(aWinsThisMap);
        mapDetails.push({ map: mapName, scoreA, scoreB });

        if (aWinsThisMap) winsA++;
        else winsB++;
      }

      match.scoreA = winsA;
      match.scoreB = winsB;
      match.details = { maps: mapDetails };

      const matchWinnerIsA = winsA > winsB;
      const winnerId = matchWinnerIsA ? match.teamAId : match.teamBId;
      //  ДИНАМІЧНА ФІТНЕС-ФУНКЦІЯ
      const winnerProb = matchWinnerIsA ? expectedProbA : 1 - expectedProbA;

      if (winnerProb >= 0.5) {
        // Фаворит виграв: даємо бали пропорційно його ймовірності
        // Якщо шанс був 90% (0.9), дасть +9 балів.
        // Якщо шанс був 51% (0.51), дасть лише +5.1 бала.
        fitness += winnerProb * 10;

        // Бонус за чисту перемогу (2:0) також пропорційний
        if (
          (matchWinnerIsA && winsB === 0) ||
          (!matchWinnerIsA && winsA === 0)
        ) {
          fitness += winnerProb * 3;
        }
      } else {
        // апсет! Аутсайдер виграв
        if (winnerProb > 0.4) {
          // Дуже рівна гра (наприклад 45% vs 55%).
          // Даємо невеликий плюс за видовищність турніру.
          fitness += 2;
        } else if (winnerProb > 0.25) {
          // Середній апсет (наприклад 30% vs 70%).
          // Легкий штраф, щоб такі матчі траплялися, але не в кожній гілці.
          fitness -= 5;
        } else {
          // (шанс < 25%).
          // Жорсткий штраф, алгоритм має уникати подібних сценаріїв.
          fitness -= 30;
        }
      }

      if (match.nextMatchWinnerId) {
        const nextMatch = bracket.find((m) => m.id === match.nextMatchWinnerId);
        if (nextMatch) {
          if (!nextMatch.teamAId) nextMatch.teamAId = winnerId;
          else nextMatch.teamBId = winnerId;
        }
      }
    }

    return { genes, fitness, bracket };
  }

  // Оцінка хромосоми для ГРУПОВОГО ЕТАПУ
  private evaluateGroupIndividual(
    genes: number[],
    baseSkeleton: SimulationMatch[],
    teamRatings: Record<string, number>,
    pastMatches: any[],
  ) {
    const bracket: SimulationMatch[] = JSON.parse(JSON.stringify(baseSkeleton));
    let fitness = 0;
    let currentGeneIndex = 0;

    // Ініціалізуємо статистику для кожної команди, точно як у вашій БД
    const standings: Record<
      string,
      {
        points: number;
        matchesWon: number;
        matchesLost: number;
        mapsWon: number;
        mapsLost: number;
        h2h: Record<string, number>;
      }
    > = {};

    Object.keys(teamRatings).forEach((teamId) => {
      standings[teamId] = {
        points: 0,
        matchesWon: 0,
        matchesLost: 0,
        mapsWon: 0,
        mapsLost: 0,
        h2h: {},
      };
    });

    for (let i = 0; i < bracket.length; i++) {
      const match = bracket[i];
      if (!match.teamAId || !match.teamBId) continue;

      const teamA = match.teamAId;
      const teamB = match.teamBId;

      const expectedProbA = this.applyHistoricalModifiers(
        this.getExpectedWinProbability(teamRatings[teamA], teamRatings[teamB]),
        teamA,
        teamB,
        pastMatches,
      );

      const availableMaps = [
        'Mirage',
        'Dust2',
        'Inferno',
        'Nuke',
        'Ancient',
        'Anubis',
        'Vertigo',
      ];
      const mapDetails: { map: string; scoreA: number; scoreB: number }[] = [];

      let winsA = 0;
      let winsB = 0;

      // Граємо Bo3
      while (winsA < 2 && winsB < 2) {
        const mapGeneRoll =
          currentGeneIndex < genes.length
            ? genes[currentGeneIndex++]
            : Math.random();
        const aWinsThisMap = mapGeneRoll <= expectedProbA;
        const mapName = availableMaps.splice(
          Math.floor(Math.random() * availableMaps.length),
          1,
        )[0];

        const { scoreA, scoreB } = this.simulateCS2Map(aWinsThisMap);
        mapDetails.push({ map: mapName, scoreA, scoreB });

        if (aWinsThisMap) winsA++;
        else winsB++;
      }

      match.scoreA = winsA;
      match.scoreB = winsB;
      match.details = { maps: mapDetails };

      const matchWinnerIsA = winsA > winsB;

      // 1. ЗАПОВНЮЄМО СТАТИСТИКУ ДЛЯ ТАБЛИЦІ (Тай-брейки)
      if (matchWinnerIsA) {
        standings[teamA].points += 3; // 3 очки за перемогу
        standings[teamA].matchesWon += 1;
        standings[teamB].matchesLost += 1;
        standings[teamA].h2h[teamB] = (standings[teamA].h2h[teamB] || 0) + 1; // Записуємо особисту перемогу
      } else {
        standings[teamB].points += 3;
        standings[teamB].matchesWon += 1;
        standings[teamA].matchesLost += 1;
        standings[teamB].h2h[teamA] = (standings[teamB].h2h[teamA] || 0) + 1;
      }

      // Рахуємо карти для Point Difference (Різниця карт)
      standings[teamA].mapsWon += winsA;
      standings[teamA].mapsLost += winsB;
      standings[teamB].mapsWon += winsB;
      standings[teamB].mapsLost += winsA;

      // 2. ФІТНЕС-ФУНКЦІЯ для групового етапу
      const winnerProb = matchWinnerIsA ? expectedProbA : 1 - expectedProbA;

      if (winnerProb >= 0.5) {
        // винагороду за  перемоги фаворитів
        fitness += winnerProb * 8;
        if ((matchWinnerIsA && winsB === 0) || (!matchWinnerIsA && winsA === 0))
          fitness += winnerProb * 2;
      } else {
        // АПСЕТ! В групах вони трапляються набагато частіше.
        if (winnerProb > 0.35) {
          // Бонус за шоу. Якщо команди були більш-менш рівні (36-49%),
          // і виграв аутсайдер — даємо алгоритму щедрий плюс +5.
          fitness += 5;
        } else if (winnerProb > 0.2) {
          // Середній апсет (21-35%).
          // НЕ ШТРАФУЄМО (0 балів)
          fitness += 0;
        } else {
          // Штраф тільки при майже неможливих сценаріях (коли команда з шансом <20% виграла).
          fitness -= 15;
        }
      }
    }

    return { genes, fitness, bracket, standings };
  }

  // ЗАПУСК ГА для single elimination
  async runSimulation(dto: SimulateTournamentDto) {
    const { tournamentId, populations } = dto;
    const GENERATIONS = 20;
    const MUTATION_RATE = 0.05;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { include: { team: true } } },
    });

    if (!tournament || tournament.status !== 'live')
      throw new BadRequestException('Турнір має бути у статусі LIVE');

    // Витягуємо історичні матчі з інших турнірів для цих команд
    const pastMatches = await this.prisma.match.findMany({
      where: {
        tournamentId: { not: tournamentId },
        isProcessed: true,
      },
    });

    const teamRatings: Record<string, number> = {};
    tournament.participants.forEach((p) => {
      teamRatings[p.teamId] = p.team.averageRating;
    });

    const dbMatches = await this.prisma.match.findMany({
      where: { tournamentId, stage: 'PLAYOFF' },
      orderBy: { round: 'asc' },
    });

    if (dbMatches.length === 0) throw new BadRequestException('Сітка порожня');

    const baseSkeleton = dbMatches.map((m) => ({
      id: m.id,
      round: m.round,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      scoreA: 0,
      scoreB: 0,
      nextMatchWinnerId: m.nextMatchWinnerId,
    }));

    const matchCount = baseSkeleton.length;
    let population: Individual[] = [];
    const estimatedGenesNeeded = matchCount * 3;

    for (let i = 0; i < populations; i++) {
      const randomGenes = Array.from({ length: estimatedGenesNeeded }, () =>
        Math.random(),
      );
      population.push(
        this.evaluateIndividual(
          randomGenes,
          baseSkeleton,
          teamRatings,
          pastMatches,
        ),
      );
    }

    for (let gen = 0; gen < GENERATIONS; gen++) {
      population.sort((a, b) => b.fitness - a.fitness);
      const nextGeneration: Individual[] = [];
      const eliteCount = Math.floor(populations * 0.1);

      for (let i = 0; i < eliteCount; i++) nextGeneration.push(population[i]);

      while (nextGeneration.length < populations) {
        const parentA =
          population[Math.floor(Math.random() * (populations / 2))];
        const parentB =
          population[Math.floor(Math.random() * (populations / 2))];
        const childGenes: number[] = [];

        for (let i = 0; i < estimatedGenesNeeded; i++) {
          let gene = Math.random() < 0.5 ? parentA.genes[i] : parentB.genes[i];
          if (Math.random() < MUTATION_RATE) gene = Math.random();
          childGenes.push(gene);
        }

        nextGeneration.push(
          this.evaluateIndividual(
            childGenes,
            baseSkeleton,
            teamRatings,
            pastMatches,
          ),
        );
      }
      population = nextGeneration;
    }

    population.sort((a, b) => b.fitness - a.fitness);
    const bestIndividual = population[0];

    await this.prisma.$transaction(
      bestIndividual.bracket.map((match) =>
        this.prisma.match.update({
          where: { id: match.id },
          data: {
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            details: match.details,
            isProcessed: true,
          },
        }),
      ),
    );

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'finished' },
    });

    return {
      message: `Еволюцію завершено! Пройдено ${GENERATIONS} поколінь.`,
      bestFitnessScore: bestIndividual.fitness,
    };
  }
  // Групова симуляція (Round Robin)
  async runGroupSimulation(dto: SimulateTournamentDto) {
    const { tournamentId, populations } = dto;
    const GENERATIONS = 20;
    const MUTATION_RATE = 0.05;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { include: { team: true } } },
    });

    if (!tournament || tournament.status !== 'live')
      throw new BadRequestException(
        'Турнір має бути у статусі LIVE (спочатку згенеруйте групи)',
      );

    // Витягуємо історичні матчі
    const pastMatches = await this.prisma.match.findMany({
      where: {
        tournamentId: { not: tournamentId },
        isProcessed: true,
      },
    });

    const teamRatings: Record<string, number> = {};
    tournament.participants.forEach((p) => {
      teamRatings[p.teamId] = p.team.averageRating;
    });

    // Беремо матчі групового етапу
    const dbMatches = await this.prisma.match.findMany({
      where: { tournamentId, stage: 'GROUP' },
      orderBy: { id: 'asc' }, // Порядок матчів у групі не критичний, беремо за ID
    });

    if (dbMatches.length === 0)
      throw new BadRequestException('Матчі групи порожні');

    const baseSkeleton = dbMatches.map((m) => ({
      id: m.id,
      round: m.round,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      scoreA: 0,
      scoreB: 0,
      nextMatchWinnerId: m.nextMatchWinnerId,
    }));

    const matchCount = baseSkeleton.length;
    let population: any[] = [];
    const estimatedGenesNeeded = matchCount * 3;

    for (let i = 0; i < populations; i++) {
      const randomGenes = Array.from({ length: estimatedGenesNeeded }, () =>
        Math.random(),
      );
      population.push(
        this.evaluateGroupIndividual(
          randomGenes,
          baseSkeleton,
          teamRatings,
          pastMatches,
        ),
      );
    }

    for (let gen = 0; gen < GENERATIONS; gen++) {
      population.sort((a, b) => b.fitness - a.fitness);
      const nextGeneration: any[] = [];
      const eliteCount = Math.floor(populations * 0.1);

      for (let i = 0; i < eliteCount; i++) nextGeneration.push(population[i]);

      while (nextGeneration.length < populations) {
        const parentA =
          population[Math.floor(Math.random() * (populations / 2))];
        const parentB =
          population[Math.floor(Math.random() * (populations / 2))];
        const childGenes: number[] = [];

        for (let i = 0; i < estimatedGenesNeeded; i++) {
          let gene = Math.random() < 0.5 ? parentA.genes[i] : parentB.genes[i];
          if (Math.random() < MUTATION_RATE) gene = Math.random();
          childGenes.push(gene);
        }

        nextGeneration.push(
          this.evaluateGroupIndividual(
            childGenes,
            baseSkeleton,
            teamRatings,
            pastMatches,
          ),
        );
      }
      population = nextGeneration;
    }

    population.sort((a, b) => b.fitness - a.fitness);
    const bestIndividual = population[0];

    // Ми зберігаємо не тільки матчі, але й одразу записуємо зароблені очки учасникам турніру!
    await this.prisma.$transaction([
      ...bestIndividual.bracket.map((match) =>
        this.prisma.match.update({
          where: { id: match.id },
          data: {
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            details: match.details,
            isProcessed: true,
          },
        }),
      ),
      // ОНОВЛЮЄМО ВСЮ СТАТИСТИКУ УЧАСНИКІВ
      ...tournament.participants.map((participant) => {
        const stats = bestIndividual.standings[participant.teamId];
        return this.prisma.tournamentParticipant.update({
          where: { id: participant.id },
          data: {
            groupPoints: stats.points,
            matchesWon: stats.matchesWon,
            matchesLost: stats.matchesLost,
            mapsWon: stats.mapsWon,
            mapsLost: stats.mapsLost,
          },
        });
      }),
    ]);

    // Після груп турнір зазвичай не закінчується, тому статус лишається live
    return {
      message: `Групову еволюцію завершено! Проаналізовано ${matchCount} матчів.`,
      bestFitnessScore: bestIndividual.fitness,
      standings: bestIndividual.standings, // Виводимо таблицю у відповідь для наочності
    };
  }
}
