import { Injectable } from '@nestjs/common';

export interface TeamForSeeding {
  id: string;
  name: string;
  rating: number;
  region: string;
}

@Injectable()
export class HeuristicSeedingService {
  public generateOptimalGroups(
    teams: TeamForSeeding[],
    numGroups: number = 4,
  ): TeamForSeeding[][] {
    if (teams.length % numGroups !== 0) {
      throw new Error(
        'Кількість команд має ділитися на кількість груп порівну',
      );
    }

    const groupCapacity = teams.length / numGroups;

    // Ініціалізуємо порожні групи
    const groups: TeamForSeeding[][] = Array.from(
      { length: numGroups },
      () => [],
    );

    // Сортуємо команди від найсильнішої до найслабшої
    const sortedTeams = [...teams].sort((a, b) => b.rating - a.rating);

    for (const team of sortedTeams) {
      let bestGroupIndex = -1;
      let minPenalty = Infinity;

      // Шукаємо найкращу групу для поточної команди
      for (let i = 0; i < numGroups; i++) {
        if (groups[i].length >= groupCapacity) {
          continue; // Група вже повна
        }

        // Рахуємо штраф для цієї групи, якщо додамо туди цю команду
        let penalty = 0;

        // 1. Штраф за регіональні колізії (найвищий пріоритет)
        const sameRegionCount = groups[i].filter(
          (t) => t.region === team.region,
        ).length;
        penalty += sameRegionCount * 1000;

        // 2. Штраф за дисбаланс рейтингу
        // Намагаємося класти сильних команд у групи з найменшим сумарним рейтингом
        const currentGroupElo = groups[i].reduce((sum, t) => sum + t.rating, 0);
        penalty += currentGroupElo;

        // 3. Штраф за різницю в кількості учасників
        // (щоб команди розподілялися рівномірно шар за шаром, як змійка)
        penalty += groups[i].length * 5000;

        if (penalty < minPenalty) {
          minPenalty = penalty;
          bestGroupIndex = i;
        }
      }

      // Розміщуємо команду в знайдену найкращу групу
      groups[bestGroupIndex].push(team);
    }

    return groups;
  }
}
