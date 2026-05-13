import { BadRequestException, Injectable } from '@nestjs/common';
import { TournamentParticipant, TournamentInvitation } from '@prisma/client';

@Injectable()
export class InvitationPolicyService {
  // ПРАВИЛО 1: Блокування нелогічних інвайтів (Tier різниця)
  // Тобто, якщо team.tier (3) - tournament.tier (1) > 1 -> це порушення.
  checkTierDifference(teamTier: number, tournamentTier: number) {
    const tierDifference = teamTier - tournamentTier;
    if (tierDifference > 1) {
      throw new BadRequestException(
        `Команда Tier ${teamTier} занадто слабка для отримання прямого запрошення на турнір Tier ${tournamentTier}. Вони мають проходити Відкриті Кваліфікації.`,
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

  // ПРАВИЛО 4: Розумна маршрутизація по стадіях
  determineAssignedStage(
    teamTier: number,
    tournamentTier: number,
  ): 'CQ' | 'GROUP' {
    return teamTier <= tournamentTier ? 'GROUP' : 'CQ';
  }
}
