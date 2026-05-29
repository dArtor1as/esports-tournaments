import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  ContextParticipant,
  SimulationMatch,
  StrategyResult,
} from './genetic-simulator.types';
import { toPrismaJson } from 'src/prisma/prisma.utils';

@Injectable()
export class GeneticSimulatorPersistence {
  constructor(private prisma: PrismaService) {}

  async saveDryRun(
    tournamentId: string,
    populations: number,
    result: StrategyResult,
  ) {
    await this.prisma.simulationRun.create({
      data: {
        tournamentId,
        algorithmType: result.algorithmType,
        populations,
        generations: result.generations,
        fitnessScore: result.bestFitnessScore,
        executionTimeMs: result.executionTimeMs,
        isDryRun: true,
        predictedData: {
          bracket: result.bracket,
          standings: result.standings,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async commitPlayoffResults(
    tournamentId: string,
    populations: number,
    result: StrategyResult,
  ) {
    const queries: Prisma.PrismaPromise<unknown>[] = [
      ...result.bracket.map((match: SimulationMatch) =>
        this.prisma.match.update({
          where: { id: match.id },
          data: {
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            details: toPrismaJson(match.details),
            stats: toPrismaJson(match.stats),
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
          algorithmType: result.algorithmType,
          populations,
          generations: result.generations,
          fitnessScore: result.bestFitnessScore,
          executionTimeMs: result.executionTimeMs,
          isDryRun: false,
        },
      }),
    ];

    await this.prisma.$transaction(queries);
  }

  async commitGroupResults(
    tournamentId: string,
    populations: number,
    participants: ContextParticipant[],
    result: StrategyResult,
  ) {
    const queries: Prisma.PrismaPromise<unknown>[] = [
      ...result.bracket.map((match: SimulationMatch) =>
        this.prisma.match.update({
          where: { id: match.id },
          data: {
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            details: toPrismaJson(match.details),
            stats: toPrismaJson(match.stats),
            isProcessed: true,
          },
        }),
      ),
      ...participants.map((p) => {
        const stats = result.standings?.[p.teamId];
        return this.prisma.tournamentParticipant.update({
          where: { id: String(p.id) },
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
          algorithmType: result.algorithmType,
          populations,
          generations: result.generations,
          fitnessScore: result.bestFitnessScore,
          executionTimeMs: result.executionTimeMs,
          isDryRun: false,
        },
      }),
    ];

    await this.prisma.$transaction(queries);
  }
}
