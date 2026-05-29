import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import * as crypto from 'crypto';
import { TeamsService } from 'src/teams/teams.service';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { TeamInvitationsLogic } from './team-invitations.logic';
import { TierHelper } from '/common/helpers/tier.helper';

@Injectable()
export class TeamInvitationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private teamsService: TeamsService,
    private accessPolicy: AccessPolicyService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createDto: CreateTeamInvitationDto, user: JwtPayload) {
    // 1. Шукаємо команду, щоб перевірити, хто її капітан
    const team = await this.prisma.team.findUnique({
      where: { id: createDto.teamId },
      include: { captain: true },
    });

    if (!team) throw new NotFoundException('Команду не знайдено');

    // 2. Тільки капітан цієї команди або Адмін можуть надсилати запрошення
    this.accessPolicy.checkCaptainOrAdmin(team.captain.userId, user);

    // 3. шукаємо користувача за нікнеймом, щоб отримати його ID для інвайту
    const targetPlayer = await this.prisma.player.findFirst({
      where: {
        nickname: createDto.playerNickname,
        gameId: team.gameId, // Гравець має бути з тієї ж гри!
      },
      include: { user: true }, // Підтягуємо юзера, щоб взяти email
    });

    if (!targetPlayer) {
      throw new NotFoundException(
        `Гравця з нікнеймом "${createDto.playerNickname}" не знайдено`,
      );
    }

    // 4. Перевіряємо, чи немає вже активного інвайту для ЦЬОГО користувача
    const existingInvite = await this.prisma.teamInvitation.findUnique({
      where: {
        teamId_userId: {
          teamId: createDto.teamId,
          userId: targetPlayer.userId, // Використовуємо знайдений ID
        },
      },
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      throw new BadRequestException(
        'Запрошення вже надіслано цьому користувачу і очікує відповіді',
      );
    }

    // 5. Генеруємо безпечний токен та термін дії (7 днів)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 6. Зберігаємо в базу (оновлюємо старий інвайт або створюємо новий)
    // Додаємо include, щоб Prisma одразу повернула назву команди та email юзера для листа
    const invite = await this.prisma.teamInvitation.upsert({
      where: {
        teamId_userId: {
          teamId: createDto.teamId,
          userId: targetPlayer.userId,
        },
      },
      update: {
        status: 'PENDING',
        token,
        expiresAt,
      },
      create: {
        teamId: createDto.teamId,
        userId: targetPlayer.userId,
        token,
        expiresAt,
      },
      include: {
        team: true,
        user: true,
      },
    });

    // 7. Відправляємо листа з посиланням для прийняття запрошення
    await this.mailService.sendTeamInvite(
      invite.user.email,
      invite.team.name,
      token,
    );

    return {
      message: 'Запрошення успішно надіслано на пошту',
      inviteId: invite.id,
    };
  }

  // Метод прийняття запрошення
  async accept(token: string, playerId: string, userId: string) {
    return this.prisma.$transaction(async (prisma) => {
      //  1. Дістаємо інвайт, гравця та поточний склад команди в одному запиті (щоб не було проблем з конкурентністю)
      const invite = await prisma.teamInvitation.findUnique({
        where: { token },
        include: { team: { include: { game: true } } },
      });
      if (!invite) throw new NotFoundException('Запрошення не знайдено');

      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });
      if (!player) throw new NotFoundException('Ігровий профіль не знайдено');

      // Дістаємо поточний склад команди ДО того, як додали нового гравця
      const teamPlayers = await prisma.player.findMany({
        where: { teamId: invite.teamId },
        select: { rating: true, teamRole: true },
      });

      const activePlayersCount = teamPlayers.filter(
        (p) => p.teamRole === 'PLAYER' || p.teamRole === 'CAPTAIN',
      ).length;

      // 2. Валідація запрошення та гравця
      TeamInvitationsLogic.validateAcceptance(invite, player, userId);

      const assignedTeamRole = TeamInvitationsLogic.determineTeamRole(
        player.inGameRole,
        activePlayersCount,
        invite.team.game.minTeamSize,
      );

      const ratingCalc = TeamInvitationsLogic.calculateTeamRating(
        teamPlayers, // Передаємо склад БЕЗ нового гравця
        player.rating,
        assignedTeamRole,
        invite.team.game.minTeamSize,
        activePlayersCount,
      );

      // 3. Оновлюємо гравця, склад команди та статус інвайту в одній транзакції
      await prisma.player.update({
        where: { id: player.id },
        data: { teamId: invite.teamId, teamRole: assignedTeamRole },
      });

      await prisma.teamTransfer.create({
        data: { playerId: player.id, teamId: invite.teamId, type: 'JOIN' },
      });
      // Якщо команда тепер повна, оновлюємо її середній рейтинг та статус
      if (ratingCalc.isComplete) {
        const newTier = TierHelper.calculateTier(ratingCalc.newAverageRating!);
        await prisma.team.update({
          where: { id: invite.teamId },
          data: {
            averageRating: ratingCalc.newAverageRating,
            tier: newTier,
            isComplete: true,
          },
        });
      } else {
        await prisma.team.update({
          where: { id: invite.teamId },
          data: { isComplete: false },
        });
      }

      await this.cacheManager.del('all_teams');

      // 4. Змінюємо статус інвайту на ACCEPTED
      return prisma.teamInvitation.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
    });
  }

  // Метод відхилення запрошення
  async decline(token: string, userId: string) {
    const invite = await this.prisma.teamInvitation.findUnique({
      where: { token },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new BadRequestException('Запрошення недійсне або вже оброблено');
    }
    if (invite.userId !== userId) {
      throw new BadRequestException(
        'Це запрошення адресоване іншому користувачу',
      );
    }

    return this.prisma.teamInvitation.update({
      where: { id: invite.id },
      data: { status: 'DECLINED' },
    });
  }
}
