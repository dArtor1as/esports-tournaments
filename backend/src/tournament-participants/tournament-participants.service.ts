import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTournamentParticipantDto } from './dto/create-tournament-participant.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

@Injectable()
export class TournamentParticipantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTournamentParticipantDto) {
    // 1. Перевіряємо турнір
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
      include: { _count: { select: { participants: true } } },
    });

    if (!tournament) throw new NotFoundException('Турнір не знайдено');
    if (tournament.status !== 'planned')
      throw new BadRequestException(
        'Реєстрація закрита. Турнір вже почався або завершився.',
      );
    if (tournament._count.participants >= tournament.maxParticipants) {
      throw new BadRequestException('На турнірі більше немає вільних місць');
    }

    // 2. Перевіряємо, чи не зареєстрована вже ця команда
    const existingParticipant =
      await this.prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_teamId: {
            tournamentId: dto.tournamentId,
            teamId: dto.teamId,
          },
        },
      });
    if (existingParticipant)
      throw new ConflictException(
        'Ваша команда вже зареєстрована на цей турнір',
      );

    // 3. Перевіряємо заявлених гравців (чи дійсно вони в цій команді)
    const players = await this.prisma.player.findMany({
      where: {
        id: { in: dto.rosterPlayerIds },
        teamId: dto.teamId,
      },
    });

    if (players.length !== dto.rosterPlayerIds.length) {
      throw new BadRequestException(
        'Один або кілька гравців не знайдені, або вони не є учасниками вашої команди',
      );
    }

    // 4. Транзакція: Створюємо учасника і фіксуємо склад (Roster)
    return this.prisma.$transaction(async (prisma) => {
      //  Реєструємо команду (створюємо сутність учасника)
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: dto.tournamentId,
          teamId: dto.teamId,
          joinedStage: 'CQ', // За замовчуванням всі стартують з CQ. Можна розширити логіку для різних посівів
          seed: tournament._count.participants + 1, // Тимчасовий посів
        },
      });

      //  Формуємо масив даних для ростеру
      const rosterData = dto.rosterPlayerIds.map((playerId) => ({
        participantId: participant.id,
        playerId: playerId,
        role: 'PLAYER' as const, // За замовчуванням всі PLAYER. Тренера можна зробити окремим ендпоінтом
      }));

      // В) Зберігаємо зліпок складу
      await prisma.tournamentRoster.createMany({
        data: rosterData,
      });

      return prisma.tournamentParticipant.findUnique({
        where: { id: participant.id },
        include: { tournamentRosters: { include: { player: true } } }, // Повертаємо красиво зі складом
      });
    });
  }

  findAllByTournament(tournamentId: string) {
    return this.prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: {
        team: {
          select: { name: true, tag: true, averageRating: true, logoUrl: true },
        },
        tournamentRosters: {
          include: { player: { select: { nickname: true } } },
        },
      },
      orderBy: { team: { averageRating: 'desc' } }, // Сортуємо від найсильніших до найслабших
    });
  }

  async remove(id: string, user: JwtPayload) {
    // 1. Шукаємо учасника разом із даними турніру (для creatorId) та команди (для captainId)
    const participant = await this.prisma.tournamentParticipant.findUnique({
      where: { id },
      include: {
        tournament: { select: { status: true, creatorId: true } },
        team: { include: { captain: true } },
      },
    });

    if (!participant) throw new NotFoundException('Учасника не знайдено');

    // 2.Перевіряємо права доступу
    const isTeamCaptain = participant.team.captain.userId === user.userId;
    const isTournamentCreator =
      participant.tournament.creatorId === user.userId;
    const isAdmin = user.role === 'ADMIN';

    if (!isTeamCaptain && !isTournamentCreator && !isAdmin) {
      throw new ForbiddenException(
        'Ви не маєте прав для скасування реєстрації цієї команди. Це може зробити лише капітан, організатор турніру або адміністратор.',
      );
    }

    // 3. Перевірка статусу турніру (тільки до старту)
    if (participant.tournament.status !== 'planned') {
      throw new BadRequestException(
        'Неможливо знятися з турніру, який вже розпочався або завершився',
      );
    }

    // 4. Транзакція: видаляємо ростер та запис учасника
    return this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.tournamentRoster.deleteMany({
        where: { participantId: id },
      });
      return prismaTx.tournamentParticipant.delete({ where: { id } });
    });
  }
}
