import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';

// Інтерфейс для зберігання структури матчу під час симуляції
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

// Особина в нашій популяції
interface Individual {
  genes: number[]; // Хромосома: масив чисел від 0 до 1 (результати "кубика" для кожного матчу)
  fitness: number; // Оцінка пристосованості
  bracket: SimulationMatch[]; // Результат симуляції з цими генами
}
// Додаткова інформація для деталей матчу
interface MapDetail {
  map: string;
  scoreA: number;
  scoreB: number;
}
@Injectable()
export class GeneticSimulatorService {
  constructor(private prisma: PrismaService) {}

  // 1. Математичне очікування (формула Elo)
  private getExpectedWinProbability(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  // 2. Симуляція рахунку (зберігаємо ваші круті деталі Bo3)
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

  // 3. Оцінка однієї хромосоми (Декодування генів у турнірну сітку)
  private evaluateIndividual(
    genes: number[],
    baseSkeleton: SimulationMatch[],
    teamRatings: Record<string, number>,
  ): Individual {
    const bracket: SimulationMatch[] = JSON.parse(JSON.stringify(baseSkeleton));
    let fitness = 0;
    let currentGeneIndex = 0; // Трекаємо, який ген використовуємо

    for (let i = 0; i < bracket.length; i++) {
      const match = bracket[i];
      if (!match.teamAId || !match.teamBId) continue;

      const ratingA = teamRatings[match.teamAId];
      const ratingB = teamRatings[match.teamBId];
      const expectedProbA = this.getExpectedWinProbability(ratingA, ratingB);

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

      // ГРАЄМО ДО 2-Х ПЕРЕМОГ (Bo3), використовуючи ОРГАНІЧНИЙ мікро-рандом
      while (winsA < 2 && winsB < 2) {
        // Беремо наступний ген із хромосоми (якщо не вистачає, кидаємо новий кубик)
        const mapGeneRoll =
          currentGeneIndex < genes.length
            ? genes[currentGeneIndex++]
            : Math.random();

        const aWinsThisMap = mapGeneRoll <= expectedProbA;
        const mapName = availableMaps.splice(
          Math.floor(Math.random() * availableMaps.length),
          1,
        )[0];

        // Симулюємо рахунок раундів для цієї мапи
        const { scoreA, scoreB } = this.simulateCS2Map(aWinsThisMap);

        mapDetails.push({ map: mapName, scoreA, scoreB });

        if (aWinsThisMap) winsA++;
        else winsB++;
      }

      match.scoreA = winsA;
      match.scoreB = winsB;
      match.details = { maps: mapDetails };

      // Органічно визначаємо переможця матчу
      const matchWinnerIsA = winsA > winsB;
      const winnerId = matchWinnerIsA ? match.teamAId : match.teamBId;

      // --- ЖОРСТКА ФІТНЕС-ФУНКЦІЯ (Захист від TA8) ---
      const winnerProb = matchWinnerIsA ? expectedProbA : 1 - expectedProbA;

      if (winnerProb >= 0.5) {
        // Фаворит виграв: невеликий стабільний плюс
        fitness += 10;

        // Бонус за чисту перемогу (2:0)
        if (
          (matchWinnerIsA && winsB === 0) ||
          (!matchWinnerIsA && winsA === 0)
        ) {
          fitness += 2;
        }
      } else {
        // АПСЕТ!
        if (winnerProb > 0.35) {
          // Рівна гра (наприклад 40% на 60%). Це нормально, даємо нуль або легкий мінус.
          fitness -= 5;
        } else if (winnerProb > 0.15) {
          // Середній апсет. Штрафуємо сильніше.
          fitness -= 15;
        } else {
          // Фантастика (шанс < 15%). Жорсткий штраф!
          fitness -= 50;
        }
      }

      // Просуваємо переможця
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

  // ГОЛОВНИЙ МЕТОД: ЗАПУСК ГА
  async runSimulation(dto: SimulateTournamentDto) {
    const { tournamentId, populations } = dto;
    const GENERATIONS = 20; // Кількість поколінь еволюції
    const MUTATION_RATE = 0.05; // 5% шанс мутації гена

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { include: { team: true } } },
    });

    if (!tournament || tournament.status !== 'live')
      throw new BadRequestException('Турнір має бути у статусі LIVE');

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

    // --- 1. ІНІЦІАЛІЗАЦІЯ ПЕРШОГО ПОКОЛІННЯ ---
    let population: Individual[] = [];
    const estimatedGenesNeeded = matchCount * 3; // По 3 гени на матч (Bo3)

    for (let i = 0; i < populations; i++) {
      // Створюємо випадкові гени
      const randomGenes = Array.from({ length: estimatedGenesNeeded }, () =>
        Math.random(),
      );
      population.push(
        this.evaluateIndividual(randomGenes, baseSkeleton, teamRatings),
      );
    }

    // --- 2. ЦИКЛ ЕВОЛЮЦІЇ ---
    for (let gen = 0; gen < GENERATIONS; gen++) {
      // Сортуємо за фітнесом (найкращі зверху)
      population.sort((a, b) => b.fitness - a.fitness);

      const nextGeneration: Individual[] = [];

      // Елітаризм: зберігаємо топ-10% найкращих особин без змін
      const eliteCount = Math.floor(populations * 0.1);
      for (let i = 0; i < eliteCount; i++) {
        nextGeneration.push(population[i]);
      }

      // --- 3. СХРЕЩУВАННЯ ТА МУТАЦІЯ ---
      while (nextGeneration.length < populations) {
        // Селекція: обираємо батьків з кращої половини популяції
        const parentA =
          population[Math.floor(Math.random() * (populations / 2))];
        const parentB =
          population[Math.floor(Math.random() * (populations / 2))];

        const childGenes: number[] = [];

        for (let i = 0; i < estimatedGenesNeeded; i++) {
          // Кросовер: випадково беремо ген або від батька А, або від Б
          let gene = Math.random() < 0.5 ? parentA.genes[i] : parentB.genes[i];

          // Мутація: з невеликим шансом ген повністю змінюється (апсет)
          if (Math.random() < MUTATION_RATE) {
            gene = Math.random();
          }
          childGenes.push(gene);
        }

        // Оцінюємо нащадка і додаємо в нове покоління
        nextGeneration.push(
          this.evaluateIndividual(childGenes, baseSkeleton, teamRatings),
        );
      }

      population = nextGeneration;
    }

    // Отримуємо абсолютного переможця після всіх поколінь
    population.sort((a, b) => b.fitness - a.fitness);
    const bestIndividual = population[0];

    // --- 4. ЗБЕРЕЖЕННЯ В БД ---
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
}
