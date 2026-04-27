import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { IMatchSimulator } from 'src/match-simulators/match-simulator.interface';
import { ProbabilityCalculatorService } from './probability-calculator.service';
import {
  SimulationMatch,
  Individual,
  GroupIndividual,
  BaseIndividual,
  GroupStanding,
} from './genetic-simulator.types';
import { Match, Stage } from '@prisma/client';

@Injectable()
export class GeneticSimulatorService {
  private readonly generations = 20;
  private readonly mutationRate = 0.05;

  constructor(
    private prisma: PrismaService,
    private matchSimulator: SimulatorFactoryService,
    private probabilityCalc: ProbabilityCalculatorService,
  ) {}

  private evolvePopulation<T extends BaseIndividual>(
    populations: number,
    estimatedGenesNeeded: number,
    evaluatorFunc: (genes: number[]) => T,
  ): T {
    let population: T[] = [];

    for (let i = 0; i < populations; i++) {
      const randomGenes = Array.from({ length: estimatedGenesNeeded }, () =>
        Math.random(),
      );
      population.push(evaluatorFunc(randomGenes));
    }

    for (let gen = 0; gen < this.generations; gen++) {
      population.sort((a, b) => b.fitness - a.fitness);
      const nextGeneration: T[] = [];
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
          if (Math.random() < this.mutationRate) gene = Math.random();
          childGenes.push(gene);
        }

        nextGeneration.push(evaluatorFunc(childGenes));
      }
      population = nextGeneration;
    }

    population.sort((a, b) => b.fitness - a.fitness);
    return population[0];
  }

  // 1. СПІЛЬНИЙ МЕТОД ПІДГОТОВКИ ДАНИХ
  private async prepareSimulationContext(tournamentId: string, stage: Stage) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: { include: { team: true } },
        game: true,
      },
    });

    if (!tournament || tournament.status !== 'live') {
      throw new BadRequestException(
        `Турнір має бути у статусі live. Спочатку згенеруйте сітку/групи.`,
      );
    }

    const simulator = this.matchSimulator.getSimulator(tournament.game.slug);

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
      where: { tournamentId, stage },
      // Для Playoff важливий порядок раундів, для груп - просто ID
      orderBy: stage === Stage.PLAYOFF ? { round: 'asc' } : { id: 'asc' },
    });

    if (dbMatches.length === 0) {
      throw new BadRequestException(`Матчі для стадії ${stage} порожні`);
    }

    const baseSkeleton: SimulationMatch[] = dbMatches.map((m) => ({
      id: m.id,
      round: m.round,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      scoreA: 0,
      scoreB: 0,
      bestOf: m.bestOf,
      nextMatchWinnerId: m.nextMatchWinnerId,
    }));

    const matchCount = baseSkeleton.length;
    const estimatedGenesNeeded = matchCount * 3;

    return {
      tournament,
      simulator,
      pastMatches,
      teamRatings,
      baseSkeleton,
      estimatedGenesNeeded,
      matchCount,
    };
  }
  // СПІЛЬНИЙ МЕТОД СИМУЛЯЦІЇ МАТЧУ
  private processMatchSimulation(
    match: SimulationMatch,
    teamRatings: Record<string, number>,
    pastMatches: Match[],
    simulator: IMatchSimulator,
    getGeneRoll: () => number,
  ) {
    const teamA = match.teamAId!;
    const teamB = match.teamBId!;

    const baseProbA = this.probabilityCalc.getBaseProbability(
      teamRatings[teamA],
      teamRatings[teamB],
    );
    const expectedProbA = this.probabilityCalc.getAdjustedProbability(
      baseProbA,
      teamA,
      teamB,
      pastMatches,
    );

    const { winsA, winsB, mapDetails } = simulator.simulateSeries(
      expectedProbA,
      match.bestOf,
      getGeneRoll,
    );

    // Записуємо результати прямо в об'єкт матчу
    match.scoreA = winsA;
    match.scoreB = winsB;
    match.details = { maps: mapDetails };

    const matchWinnerIsA = winsA > winsB;
    const winnerId = matchWinnerIsA ? teamA : teamB;
    const winnerProb = matchWinnerIsA ? expectedProbA : 1 - expectedProbA;

    return { matchWinnerIsA, winnerId, winnerProb, winsA, winsB };
  }

  private evaluateIndividual(
    genes: number[],
    baseSkeleton: SimulationMatch[],
    teamRatings: Record<string, number>,
    pastMatches: Match[],
    simulator: IMatchSimulator,
  ): Individual {
    const bracket: SimulationMatch[] = baseSkeleton.map((m) => ({ ...m }));
    let fitness = 0;
    let currentGeneIndex = 0;
    const getGeneRoll = () =>
      currentGeneIndex < genes.length
        ? genes[currentGeneIndex++]
        : Math.random();

    for (let i = 0; i < bracket.length; i++) {
      const match = bracket[i];
      if (!match.teamAId || !match.teamBId) continue;

      // Використовуємо наш новий метод!
      const { matchWinnerIsA, winnerId, winnerProb, winsA, winsB } =
        this.processMatchSimulation(
          match,
          teamRatings,
          pastMatches,
          simulator,
          getGeneRoll,
        );

      // 1. Розрахунок Fitness (штрафуємо за нелогічні результати)
      if (winnerProb >= 0.5) {
        fitness += winnerProb * 10;
        if (
          (matchWinnerIsA && winsB === 0) ||
          (!matchWinnerIsA && winsA === 0)
        ) {
          fitness += winnerProb * 3;
        }
      } else {
        if (winnerProb > 0.4) fitness += 2;
        else if (winnerProb > 0.25) fitness -= 5;
        else fitness -= 30;
      }

      // 2. Просування переможця по сітці (Специфіка Playoff)
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

  private evaluateGroupIndividual(
    genes: number[],
    baseSkeleton: SimulationMatch[],
    teamRatings: Record<string, number>,
    pastMatches: Match[],
    simulator: IMatchSimulator,
  ): GroupIndividual {
    const bracket: SimulationMatch[] = baseSkeleton.map((m) => ({ ...m }));
    let fitness = 0;
    let currentGeneIndex = 0;
    const getGeneRoll = () =>
      currentGeneIndex < genes.length
        ? genes[currentGeneIndex++]
        : Math.random();

    const standings: Record<string, GroupStanding> = {};
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

      // Використовуємо наш новий метод!
      const { matchWinnerIsA, winnerProb, winsA, winsB } =
        this.processMatchSimulation(
          match,
          teamRatings,
          pastMatches,
          simulator,
          getGeneRoll,
        );

      // 1. Оновлення турнірної таблиці (Специфіка Груп)
      if (matchWinnerIsA) {
        standings[teamA].points += 3;
        standings[teamA].matchesWon += 1;
        standings[teamB].matchesLost += 1;
        standings[teamA].h2h[teamB] = (standings[teamA].h2h[teamB] || 0) + 1;
      } else {
        standings[teamB].points += 3;
        standings[teamB].matchesWon += 1;
        standings[teamA].matchesLost += 1;
        standings[teamB].h2h[teamA] = (standings[teamB].h2h[teamA] || 0) + 1;
      }

      standings[teamA].mapsWon += winsA;
      standings[teamA].mapsLost += winsB;
      standings[teamB].mapsWon += winsB;
      standings[teamB].mapsLost += winsA;

      // 2. Розрахунок Fitness
      if (winnerProb >= 0.5) {
        fitness += winnerProb * 8;
        if (
          (matchWinnerIsA && winsB === 0) ||
          (!matchWinnerIsA && winsA === 0)
        ) {
          fitness += winnerProb * 2;
        }
      } else {
        if (winnerProb > 0.35) fitness += 5;
        else if (winnerProb > 0.2) fitness += 0;
        else fitness -= 15;
      }
    }

    return { genes, fitness, bracket, standings };
  }

  async findRunsByTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!tournament) {
      throw new NotFoundException('Турнір не знайдено');
    }

    return this.prisma.simulationRun.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async runSimulation(dto: SimulateTournamentDto) {
    const startedAt = Date.now();
    const { tournamentId, populations } = dto;

    // Використовуємо спільний метод
    const simulationContext = await this.prepareSimulationContext(
      tournamentId,
      Stage.PLAYOFF,
    );

    const bestIndividual = this.evolvePopulation<Individual>(
      populations,
      simulationContext.estimatedGenesNeeded,
      (genes) =>
        this.evaluateIndividual(
          genes,
          simulationContext.baseSkeleton,
          simulationContext.teamRatings,
          simulationContext.pastMatches,
          simulationContext.simulator,
        ),
    );

    const executionTimeMs = Date.now() - startedAt;

    await this.prisma.$transaction([
      ...bestIndividual.bracket.map((match) =>
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
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'finished' },
      }),
      this.prisma.simulationRun.create({
        data: {
          tournamentId,
          algorithmType: 'PLAYOFF',
          populations,
          generations: this.generations,
          fitnessScore: bestIndividual.fitness,
          executionTimeMs,
        },
      }),
    ]);

    return {
      message: `Еволюцію завершено. Пройдено ${this.generations} поколінь.`,
      bestFitnessScore: bestIndividual.fitness,
    };
  }

  async runGroupSimulation(dto: SimulateTournamentDto) {
    const startedAt = Date.now();
    const { tournamentId, populations } = dto;

    // Використовуємо спільний метод
    const simulationContext = await this.prepareSimulationContext(
      tournamentId,
      Stage.GROUP,
    );

    const bestIndividual = this.evolvePopulation<GroupIndividual>(
      populations,
      simulationContext.estimatedGenesNeeded,
      (genes) =>
        this.evaluateGroupIndividual(
          genes,
          simulationContext.baseSkeleton,
          simulationContext.teamRatings,
          simulationContext.pastMatches,
          simulationContext.simulator,
        ),
    );

    const executionTimeMs = Date.now() - startedAt;

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
      ...simulationContext.tournament.participants.map((participant) => {
        const stats = bestIndividual.standings[participant.teamId];
        return this.prisma.tournamentParticipant.update({
          where: { id: participant.id },
          data: {
            groupPoints: stats?.points || 0,
            matchesWon: stats?.matchesWon || 0,
            matchesLost: stats?.matchesLost || 0,
            mapsWon: stats?.mapsWon || 0,
            mapsLost: stats?.mapsLost || 0,
          },
        });
      }),
      this.prisma.simulationRun.create({
        data: {
          tournamentId,
          algorithmType: 'GROUP_STAGE',
          populations,
          generations: this.generations,
          fitnessScore: bestIndividual.fitness,
          executionTimeMs,
        },
      }),
    ]);

    return {
      message: `Групову еволюцію завершено. Проаналізовано ${simulationContext.matchCount} матчів.`,
      bestFitnessScore: bestIndividual.fitness,
      standings: bestIndividual.standings,
    };
  }
}
