import { BadRequestException, Injectable } from '@nestjs/common';
import { TournamentParticipant, TournamentInvitation } from '@prisma/client';

@Injectable()
export class InvitationPolicyService {
  // ПРАВИЛО 1: Блокування нелогічних інвайтів (Tier різниця)
  // Тобто, якщо team.tier (3) - tournament.tier (1) > 1 -> це порушення.
  checkTierDifference(teamTier: number, tournamentTier: number) {
    const tierDiff = Math.abs(teamTier - tournamentTier);
    if (tierDiff > 1) {
      throw new BadRequestException(
        `Рівень команди (Tier ${teamTier}) не відповідає турніру (Tier ${tournamentTier}). Максимально дозволена різниця — 1 рівень.`,
      );
    }
  }

  // ПРАВИЛО 2: Контроль ліміту місць
  checkCapacity(
    currentParticipants: number,
    pendingInvites: number,
    maxParticipants: number,
  ) {
    if (currentParticipants + pendingInvites >= maxParticipants) {
      throw new BadRequestException(
        'На турнірі більше немає вільних слотів (враховуючи вже надіслані запрошення)',
      );
    }
  }

  // ПРАВИЛО 3: Перевірка на дублікати
  checkDuplicates(
    existingParticipant: TournamentParticipant | null,
    existingInvite: TournamentInvitation | null,
  ) {
    if (existingParticipant) {
      throw new BadRequestException('Команда вже бере участь у цьому турнірі');
    }
    if (existingInvite) {
      throw new BadRequestException('Запрошення вже надіслано');
    }
  }
  // ПРАВИЛО 4: Регіональне обмеження турніру
  checkRegionRestriction(teamRegion: string, tournamentRegion: string) {
    if (tournamentRegion !== 'GLOBAL' && teamRegion !== tournamentRegion) {
      throw new BadRequestException(
        `Регіональний конфлікт: цей турнір обмежений регіоном ${tournamentRegion}, а ваша команда зареєстрована в регіоні ${teamRegion}.`,
      );
    }
  }

  // ПРАВИЛО 5: Розумна маршрутизація по стадіях
  determineAssignedStage(
    teamTier: number,
    tournamentTier: number,
  ): 'CQ' | 'GROUP' {
    return teamTier <= tournamentTier ? 'GROUP' : 'CQ';
  }
}
