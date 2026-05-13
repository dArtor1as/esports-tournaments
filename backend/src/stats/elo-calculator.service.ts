import { Injectable } from '@nestjs/common';

@Injectable()
export class EloCalculatorService {
  calculateElo(
    ratingA: number,
    ratingB: number,
    isAWinner: boolean,
    kFactor: number,
    stage: string,
    bracket: string,
  ) {
    // K-FACTOR
    // 1. Групи = 20, Плей-оф = 32, Гранд Фінал = 40
    let baseK = 32;
    if (stage === 'GROUP') baseK = 20;
    if (bracket === 'GRAND_FINAL') baseK = 40;

    // 2. Якщо грають профи топ рівня (>3000 Elo), зменшуємо зміну рейтингу
    if (ratingA > 3000 || ratingB > 3000) baseK = 16;

    const finalK = baseK * kFactor;

    // Рахуємо очікувану ймовірність перемоги
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    const actualA = isAWinner ? 1 : 0;
    const actualB = isAWinner ? 0 : 1;

    let changeA = Math.round(finalK * (actualA - expectedA));
    let changeB = Math.round(finalK * (actualB - expectedB));

    // Бонус за чемпіонство
    if (bracket === 'GRAND_FINAL') {
      const championshipBonus = Math.round(30 * kFactor);
      if (isAWinner) changeA += championshipBonus;
      else changeB += championshipBonus;
    }

    return { changeA, changeB };
  }
}
