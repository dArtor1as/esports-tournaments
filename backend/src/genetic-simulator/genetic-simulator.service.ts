import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulateTournamentDto } from './dto/simulate-tournament.dto';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { Stage } from '@prisma/client';
import { SimulationMatch } from './genetic-simulator.types';
import { SingleEliminationStrategy } from './strategies/single-elimination.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { SimulationContext } from './genetic-simulator.types';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { StatsService } from 'src/stats/stats.service';

@Injectable()
export class GeneticSimulatorService {
  constructor(
    private prisma: PrismaService,
    private matchSimulator: SimulatorFactoryService,
    private statsService: StatsService,
    // Інжектимо стратегії:
    private singleEliminationStrategy: SingleEliminationStrategy,
    private groupStageStrategy: GroupStageStrategy,
    private doubleEliminationStrategy: DoubleEliminationStrategy,
  ) {}

  // метод підготовки, він використовується для всіх типів симуляцій, щоб отримати всі необхідні дані та контекст
  private async prepareSimulationContext(
    tournamentId: string,
    stage: Stage,
    user: JwtPayload,
  ): Promise<SimulationContext> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          include: {
            team: {
              include: { players: true }, // Додаємо завантаження всіх гравців команди як фолбек
            },
            // Тягнемо заявлений ростер, щоб отримати дані про гравців
            tournamentRosters: {
              include: { player: true },
            },
          },
        },
        game: true,
      },
    });

    if (!tournament || tournament.status !== 'live') {
      throw new BadRequestException(
        `Турнір має бути у статусі live. Спочатку згенеруйте сітку/групи.`,
      );
    }

    if (tournament.creatorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Ви не маєте права запускати симуляцію для чужого турніру',
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
    const teamsData: Record<string, any> = {}; //  словник для симулятора

    tournament.participants.forEach((p) => {
      teamRatings[p.teamId] = p.team.averageRating;

      let activePlayers;

      // перевіряємо чи є спеціально поданий ростер на цей турнір?
      if (p.tournamentRosters && p.tournamentRosters.length > 0) {
        activePlayers = p.tournamentRosters
          .filter((roster) => roster.role !== 'COACH')
          .map((roster) => roster.player);
      } else {
        // якщо ростер не подано, беремо основний склад команди
        // Фільтруємо за роллю в профілі гравця, якщо вона вказана
        activePlayers = p.team.players.filter(
          (player) => player.inGameRole !== 'COACH',
        );
      }

      teamsData[p.teamId] = {
        id: p.teamId,
        rating: p.team.averageRating,
        players: activePlayers.map((player) => ({
          id: player.id,
          rating: player.rating,
          inGameRole: player.inGameRole,
        })),
      };
    });

    const dbMatches = await this.prisma.match.findMany({
      where: { tournamentId, stage },
    });

    if (dbMatches.length === 0) {
      throw new BadRequestException(`Матчі для стадії ${stage} порожні`);
    }

    if (stage === Stage.PLAYOFF) {
      dbMatches.sort((a, b) => {
        // 0. Гранд-фінал ЗАВЖДИ розраховується останнім
        if (a.bracket === 'GRAND_FINAL') return 1;
        if (b.bracket === 'GRAND_FINAL') return -1;

        // 1. Спочатку сортуємо за раундами
        if (a.round !== b.round) return a.round - b.round;

        // 2. В межах одного раунду UPPER має йти ПЕРЕД LOWER
        const bracketOrder = { UPPER: 1, LOWER: 2, NONE: 3 };
        return bracketOrder[a.bracket] - bracketOrder[b.bracket];
      });
    } else {
      dbMatches.sort((a, b) => a.id.localeCompare(b.id));
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
      nextMatchLoserId: m.nextMatchLoserId,
    }));

    return {
      tournament,
      simulator,
      pastMatches,
      teamRatings,
      teamsData,
      baseSkeleton,
      estimatedGenesNeeded: baseSkeleton.length * 3,
      matchCount: baseSkeleton.length,
    };
  }

  // Головні методи запуску
  async runSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const context = await this.prepareSimulationContext(
      dto.tournamentId,
      Stage.PLAYOFF,
      user,
    );

    // Логіка вибору стратегії на основі налаштувань турніру
    const bracketType = context.tournament.settings?.bracketType;
    let result;
    if (bracketType === 'DOUBLE_ELIMINATION') {
      result = await this.doubleEliminationStrategy.execute(
        context,
        dto.populations,
      );
    } else {
      result = await this.singleEliminationStrategy.execute(
        context,
        dto.populations,
      );
    }
    // Після того, як турнір отримав статус 'finished'
    // ми одразу викликаємо наш сервіс для урахування статистики та оновлення Elo рейтингу
    await this.statsService.processTournamentStats(dto.tournamentId);

    return {
      ...result,
      statsMessage: 'Статистику гравців та рейтинги Elo успішно перераховано!',
    };
  }

  async runGroupSimulation(dto: SimulateTournamentDto, user: JwtPayload) {
    const context = await this.prepareSimulationContext(
      dto.tournamentId,
      Stage.GROUP,
      user,
    );
    const result = await this.groupStageStrategy.execute(
      context,
      dto.populations,
    );

    //запускаємо обробку статистики
    await this.statsService.processTournamentStats(dto.tournamentId);

    return {
      ...result,
      statsMessage: 'Результати груп та Elo гравців успішно оновлено.',
    };
  }

  async findRunsByTournament(tournamentId: string, user: JwtPayload) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, creatorId: true },
    });

    if (!tournament) {
      throw new NotFoundException('Турнір не знайдено');
    }

    if (tournament.creatorId !== user.userId && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Ви не маєте права запускати симуляцію для чужого турніру',
      );
    }

    return this.prisma.simulationRun.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
