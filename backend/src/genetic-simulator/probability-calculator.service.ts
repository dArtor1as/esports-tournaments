import { Injectable } from '@nestjs/common';
import { Match } from '@prisma/client';

@Injectable()
export class ProbabilityCalculatorService {
  // Виносимо число в константу
  private readonly ELO_DIVISOR = 400;
  private readonly MIN_PROBABILITY = 0.01;
  private readonly MAX_PROBABILITY = 0.99;

  //1. Базова ймовірність за системою Elo
  getBaseProbability(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / this.ELO_DIVISOR));
  }

  // 2. Обчислення фінальної ймовірності з урахуванням історії матчів
  getAdjustedProbability(
    baseProbA: number,
    teamAId: string,
    teamBId: string,
    pastMatches: Match[],
  ): number {
    let h2hBonus = 0;

    // Аналіз H2H (Очні зустрічі)
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
      h2hBonus = (winrateA - 0.5) * 0.1; // Максимальний бонус: 0.05
    }

    // Застосовуємо модифікатори
    const formBonusA = this.calculateFormBonus(teamAId, pastMatches);
    const formBonusB = this.calculateFormBonus(teamBId, pastMatches);

    const finalProb = baseProbA + h2hBonus + formBonusA - formBonusB;

    // Захист від виходу за межі
    return Math.max(
      this.MIN_PROBABILITY,
      Math.min(this.MAX_PROBABILITY, finalProb),
    );
  }

  // Допоміжний метод для аналізу форми команди
  private calculateFormBonus(teamId: string, pastMatches: Match[]): number {
    const teamMatches = pastMatches.filter(
      (m) => m.teamAId === teamId || m.teamBId === teamId,
    );

    if (teamMatches.length === 0) return 0;

    let wins = 0;
    teamMatches.forEach((m) => {
      if (m.teamAId === teamId && m.scoreA > m.scoreB) wins++;
      if (m.teamBId === teamId && m.scoreB > m.scoreA) wins++;
    });

    // Максимальний вплив форми: 0.025
    return (wins / teamMatches.length - 0.5) * 0.05;
  }
}
