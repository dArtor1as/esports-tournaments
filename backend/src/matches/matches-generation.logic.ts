import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TournamentSettings } from '../genetic-simulator/genetic-simulator.types';

@Injectable()
export class MatchesGenerationLogic {
  private readonly logger = new Logger(MatchesGenerationLogic.name);

  //  парсинг JSON налаштувань турніру

  public parseSettings(
    rawSettings: unknown,
    tournamentId: string,
  ): TournamentSettings {
    let settingsData: TournamentSettings =
      (rawSettings as TournamentSettings) || {};
    if (typeof rawSettings === 'string') {
      try {
        settingsData = JSON.parse(rawSettings) as TournamentSettings;
      } catch (error) {
        const trace = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Помилка парсингу JSON налаштувань для турніру ${tournamentId}`,
          trace,
        );
        settingsData = {} as TournamentSettings;
      }
    }
    return settingsData;
  }

  //  валідація генерації Плей-оф

  public validatePlayoffGeneration(
    status: string,
    existingPlayoffMatchesCount: number,
    requestedTeamCount: number | undefined,
    participantsCount: number,
  ): number {
    if (status === 'finished' || status === 'cancelled') {
      throw new BadRequestException('Турнір вже завершено');
    }
    if (existingPlayoffMatchesCount > 0) {
      throw new BadRequestException('Сітка плей-оф вже згенерована');
    }

    const teamCount = requestedTeamCount ?? participantsCount;

    if (requestedTeamCount && requestedTeamCount > participantsCount) {
      throw new BadRequestException(
        `Недостатньо учасників. Зареєстровано: ${participantsCount}.`,
      );
    }

    if (teamCount < 4 || !Number.isInteger(Math.log2(teamCount))) {
      throw new BadRequestException(
        `Кількість команд має бути 4, 8, 16, 32 тощо. Зараз: ${teamCount}`,
      );
    }

    return teamCount;
  }

  //  валідація генерації Груп

  public validateGroupGeneration(
    status: string,
    existingGroupMatchesCount: number,
    requestedTeamCount: number | undefined,
    participantsCount: number,
    requestedGroupCount: number | undefined,
    settingsGroupCount: number | undefined,
  ): { teamCount: number; effectiveGroupCount: number } {
    if (status !== 'planned') {
      throw new BadRequestException(
        'Групи вже згенеровані або турнір завершено',
      );
    }
    if (existingGroupMatchesCount > 0) {
      throw new BadRequestException('Груповий етап вже згенеровано');
    }

    const teamCount = requestedTeamCount ?? participantsCount;

    if (teamCount < 4) {
      throw new BadRequestException(
        'Для групового етапу потрібно мінімум 4 команди',
      );
    }

    //  визначаємо кількість груп
    const effectiveGroupCount = requestedGroupCount ?? settingsGroupCount ?? 2;
    const teamsPerGroup = teamCount / effectiveGroupCount;

    //  Мінімум 2 команди в одній групі
    if (teamsPerGroup < 2) {
      throw new BadRequestException(
        `Зараз виходить ${teamsPerGroup} команд(и) у групі. Груповий етап не має сенсу. Будь ласка, оберіть меншу кількість груп (щоб було мінімум 4 команди на групу).`,
      );
    }

    //  перевірка на ділимість та парність у групах
    if (
      teamCount % effectiveGroupCount !== 0 ||
      (teamCount / effectiveGroupCount) % 2 !== 0
    ) {
      const validGroups: number[] = [];
      for (let i = 1; i <= teamCount / 2; i++) {
        if (teamCount % i === 0 && (teamCount / i) % 2 === 0) {
          validGroups.push(i);
        }
      }

      throw new BadRequestException(
        `Неможливо розбити ${teamCount} команд на ${effectiveGroupCount} груп так, щоб у кожній була ПАРНА кількість. Допустимі варіанти: ${
          validGroups.length > 0 ? validGroups.join(', ') : 'немає'
        }.`,
      );
    }

    return { teamCount, effectiveGroupCount };
  }
}
