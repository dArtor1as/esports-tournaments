import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma, RosterRole } from '@prisma/client';
import { AcceptTournamentInvitationDto } from './dto/accept-tournament-invitation.dto';
import { TournamentSettings } from '../genetic-simulator/genetic-simulator.types';

export class TournamentInvitationsLogic {
  private static readonly logger = new Logger(TournamentInvitationsLogic.name);

  // 1. Форматування та валідація ростеру
  static validateAndFormatRoster(
    dto: AcceptTournamentInvitationDto,
    teamPlayers: { id: string }[],
    captainId: string,
  ): Array<{ playerId: string; role: RosterRole }> {
    let finalRoster: Array<{ playerId: string; role: RosterRole }> = [];

    // Підтримка зворотної сумісності DTO
    if (dto.rosterPlayers && dto.rosterPlayers.length > 0) {
      finalRoster = dto.rosterPlayers.map((p) => ({
        playerId: p.playerId,
        role: p.role as RosterRole,
      }));
    } else if (dto.rosterPlayerIds && dto.rosterPlayerIds.length > 0) {
      finalRoster = dto.rosterPlayerIds.map((id) => ({
        playerId: id,
        role: (id === captainId ? 'CAPTAIN' : 'PLAYER') as RosterRole,
      }));
    } else {
      throw new BadRequestException('Необхідно надати список гравців ростера.');
    }

    // Перевірка належності до команди
    const teamPlayerIds = new Set(teamPlayers.map((p) => p.id));
    for (const roster of finalRoster) {
      if (!teamPlayerIds.has(roster.playerId)) {
        throw new BadRequestException(
          `Гравець з ID ${roster.playerId} не належить команді`,
        );
      }
    }

    // Перевірка на дублікати в заявці
    const uniqueIds = new Set(finalRoster.map((r) => r.playerId));
    if (uniqueIds.size !== finalRoster.length) {
      throw new BadRequestException(
        'Гравці у турнірному складі не повинні повторюватися',
      );
    }

    // Бізнес-валідація (Правила 5v5)
    const activeCount = finalRoster.filter(
      (r) => r.role === 'PLAYER' || r.role === 'CAPTAIN',
    ).length;
    const coachCount = finalRoster.filter((r) => r.role === 'COACH').length;
    const substituteCount = finalRoster.filter(
      (r) => r.role === 'SUBSTITUTE',
    ).length;

    if (activeCount !== 5) {
      throw new BadRequestException(
        `Для участі потрібно рівно 5 активних гравців (зараз обрано: ${activeCount}).`,
      );
    }
    if (coachCount > 1) {
      throw new BadRequestException('У ростері може бути не більше 1 тренера.');
    }
    if (substituteCount > 1) {
      throw new BadRequestException(
        'У ростері може бути не більше 1 запасного гравця (Substitute).',
      );
    }

    return finalRoster;
  }

  // 2. Безпечний парсинг налаштувань турніру для визначення стадії
  static determineInitialStage(
    settingsRaw: Prisma.JsonValue,
    inviteToken: string,
  ): 'GROUP' | 'PLAYOFF' {
    let settingsData: TournamentSettings =
      (settingsRaw as unknown as TournamentSettings) || {};

    if (typeof settingsRaw === 'string') {
      try {
        settingsData = JSON.parse(settingsRaw) as TournamentSettings;
      } catch (error) {
        const trace = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Помилка парсингу JSON налаштувань для інвайту ${inviteToken}`,
          trace,
        );
        settingsData = {} as TournamentSettings;
      }
    }

    return settingsData.bracketType === 'ROUND_ROBIN' ? 'GROUP' : 'PLAYOFF';
  }
}
