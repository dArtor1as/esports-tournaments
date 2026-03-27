import { Injectable } from '@nestjs/common';

// Інтерфейс для того, що ми балансуємо
export interface TeamForSeeding {
  id: string;
  name: string;
  rating: number;
  region: string;
}

@Injectable()
export class GeneticSeedingService {
  private readonly POPULATION_SIZE = 50;
  private readonly GENERATIONS = 100;
  private readonly MUTATION_RATE = 0.1;

  /**
   * Головний метод: розбиває команди на ідеальні групи
   */
  public generateOptimalGroups(
    teams: TeamForSeeding[],
    numGroups: number = 2,
  ): TeamForSeeding[][] {
    if (teams.length % numGroups !== 0) {
      throw new Error(
        'Кількість команд має ділитися на кількість груп порівну',
      );
    }

    // 1. Створюємо початкову популяцію (випадкові розбиття на групи)
    let population = this.initializePopulation(teams, numGroups);

    // 2. Еволюція
    for (let gen = 0; gen < this.GENERATIONS; gen++) {
      // Рахуємо пристосованість (fitness) для кожного індивіда
      const fitnessScores = population.map((individual) =>
        this.calculateFitness(individual),
      );

      // Створюємо нове покоління
      const newPopulation: TeamForSeeding[][][] = [];

      for (let i = 0; i < this.POPULATION_SIZE; i++) {
        // Вибір батьків (Турнірна селекція)
        const parent1 = this.tournamentSelection(population, fitnessScores);
        const parent2 = this.tournamentSelection(population, fitnessScores);

        // Кросовер та Мутація
        let child = this.crossover(parent1, parent2, numGroups);
        child = this.mutate(child);

        newPopulation.push(child);
      }

      population = newPopulation;
    }

    // 3. Знаходимо найкращого індивіда в останньому поколінні
    const finalFitness = population.map((ind) => this.calculateFitness(ind));
    const bestIndex = finalFitness.indexOf(Math.min(...finalFitness));

    return population[bestIndex];
  }

  // =========================================================
  // ВНУТРІШНІ МЕТОДИ ГЕНЕТИЧНОГО АЛГОРИТМУ
  // =========================================================

  private initializePopulation(
    teams: TeamForSeeding[],
    numGroups: number,
  ): TeamForSeeding[][][] {
    const population: TeamForSeeding[][][] = [];
    for (let i = 0; i < this.POPULATION_SIZE; i++) {
      // Перемішуємо масив команд випадковим чином (Fisher-Yates)
      const shuffled = [...teams].sort(() => Math.random() - 0.5);

      // Розбиваємо на групи
      const individual: TeamForSeeding[][] = [];
      const groupSize = teams.length / numGroups;
      for (let g = 0; g < numGroups; g++) {
        individual.push(shuffled.slice(g * groupSize, (g + 1) * groupSize));
      }
      population.push(individual);
    }
    return population;
  }

  /**
   * Функція пристосованості (ЧИМ МЕНШЕ ЗНАЧЕННЯ - ТИМ КРАЩЕ)
   */
  private calculateFitness(groups: TeamForSeeding[][]): number {
    let penalty = 0;

    // 1. Штраф за різницю в рейтингу (Шукаємо дисперсію середнього Elo)
    const groupAverages = groups.map((group) => {
      const sum = group.reduce((acc, team) => acc + team.rating, 0);
      return sum / group.length;
    });

    const totalAverage =
      groupAverages.reduce((a, b) => a + b, 0) / groupAverages.length;

    // Додаємо різницю до штрафу
    groupAverages.forEach((avg) => {
      penalty += Math.abs(totalAverage - avg);
    });

    // 2. Штраф за однакові регіони в одній групі
    groups.forEach((group) => {
      const regions = group.map((t) => t.region);
      const uniqueRegions = new Set(regions);
      // Якщо унікальних регіонів менше ніж команд -> є дублікати. Штрафуємо жорстко!
      const regionalCollisions = group.length - uniqueRegions.size;
      penalty += regionalCollisions * 500; // 500 балів штрафу за кожне співпадіння регіону
    });

    return penalty;
  }

  private tournamentSelection(
    population: TeamForSeeding[][][],
    fitnessScores: number[],
  ): TeamForSeeding[][] {
    // Беремо 3 випадкових індивідів і вибираємо найкращого (з найменшим штрафом)
    const k = 3;
    let bestIdx = Math.floor(Math.random() * this.POPULATION_SIZE);

    for (let i = 1; i < k; i++) {
      const randomIdx = Math.floor(Math.random() * this.POPULATION_SIZE);
      if (fitnessScores[randomIdx] < fitnessScores[bestIdx]) {
        bestIdx = randomIdx;
      }
    }
    return population[bestIdx];
  }

  private crossover(
    parent1: TeamForSeeding[][],
    parent2: TeamForSeeding[][],
    numGroups: number,
  ): TeamForSeeding[][] {
    // Для простоти, щоб не зламати розмір груп, ми як кросовер беремо Parent 1
    // і робимо "часткову" заміну з Parent 2, або просто пропускаємо кросовер
    // і покладаємося на мутацію (класичний підхід для задачі розподілу).
    // Повертаємо глибоку копію Parent1.
    return parent1.map((group) => [...group]);
  }

  private mutate(individual: TeamForSeeding[][]): TeamForSeeding[][] {
    if (Math.random() > this.MUTATION_RATE) return individual;

    // Суть мутації: беремо двох випадкових команд з РІЗНИХ груп і міняємо їх місцями
    const groupAIdx = Math.floor(Math.random() * individual.length);
    let groupBIdx = Math.floor(Math.random() * individual.length);
    while (groupAIdx === groupBIdx) {
      groupBIdx = Math.floor(Math.random() * individual.length);
    }

    const teamAIdx = Math.floor(Math.random() * individual[groupAIdx].length);
    const teamBIdx = Math.floor(Math.random() * individual[groupBIdx].length);

    // Міняємо місцями
    const temp = individual[groupAIdx][teamAIdx];
    individual[groupAIdx][teamAIdx] = individual[groupBIdx][teamBIdx];
    individual[groupBIdx][teamBIdx] = temp;

    return individual;
  }
}
