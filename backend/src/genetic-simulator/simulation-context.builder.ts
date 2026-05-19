import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimulatorFactoryService } from 'src/match-simulators/simulator-factory.service';
import { Bracket, Stage } from '@prisma/client';
import { SimulationContext, SimulationMatch } from './genetic-simulator.types';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Injectable()
export class SimulationContextBuilder {
  constructor(
    private prisma: PrismaService,
    private matchSimulator: SimulatorFactoryService,
    private accessPolicy: AccessPolicyService,
  ) {}

  // метод підготовки, він використовується для всіх типів симуляцій, щоб отримати всі необхідні дані та контекст
  public async prepareSimulationContext(
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

    this.accessPolicy.checkTournamentCreatorOrAdmin(tournament.creatorId, user);

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
          // Дозволяємо грати ТІЛЬКИ гравцям основи та капітану.
          .filter(
            (roster) => roster.role === 'PLAYER' || roster.role === 'CAPTAIN',
          )
          .map((roster) => roster.player);
      } else {
        // Якщо ростер не подано, беремо основний склад команди
        // Фільтруємо за роллю в профілі гравця, відсікаючи заміну та тренера
        activePlayers = p.team.players.filter(
          (player) =>
            player.teamRole === 'PLAYER' || player.teamRole === 'CAPTAIN',
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
        if (a.bracket === 'GRAND_FINAL' && b.bracket !== 'GRAND_FINAL')
          return 1;
        if (b.bracket === 'GRAND_FINAL' && a.bracket !== 'GRAND_FINAL')
          return -1;

        // 1. Спочатку сортуємо за раундами
        if (a.round !== b.round) return a.round - b.round;

        // 2. В межах одного раунду UPPER має йти ПЕРЕД LOWER
        const bracketOrder: Record<string, number> = {
          UPPER: 1,
          LOWER: 2,
          NONE: 3,
          GRAND_FINAL: 4,
        };
        return (
          (bracketOrder[a.bracket] || 99) - (bracketOrder[b.bracket] || 99)
        );
      });
    } else {
      dbMatches.sort((a, b) => a.id.localeCompare(b.id));
    }

    const baseSkeleton: SimulationMatch[] = dbMatches.map((m) => ({
      id: m.id,
      stage: m.stage,
      bracket: m.bracket,
      groupName: m.groupName,
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
}
