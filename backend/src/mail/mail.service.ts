import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  async sendTeamInvite(email: string, teamName: string, token: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const inviteLink = `${frontendUrl}/invite/team?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: `Запрошення в команду ${teamName}`,
      html: `
        <h2>Привіт!</h2>
        <p>Вас запросили приєднатися до кіберспортивної команди <b>${teamName}</b>.</p>
        <p>Щоб прийняти запрошення, перейдіть за посиланням нижче (діє 7 днів):</p>
        <a href="${inviteLink}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
          Прийняти запрошення
        </a>
        <p><small>Якщо кнопка не працює, скопіюйте це посилання: ${inviteLink}</small></p>
      `,
    });
  }

  async sendTournamentInvite(
    email: string,
    tournamentName: string,
    teamName: string,
    token: string,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const inviteLink = `${frontendUrl}/invite/tournament?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: `Запрошення на турнір ${tournamentName}`,
      html: `
        <h2>Вітаємо, капітане!</h2>
        <p>Ваша команда <b>${teamName}</b> отримала пряме запрошення на турнір <b>${tournamentName}</b>.</p>
        <a href="${inviteLink}" style="padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
          Переглянути та підтвердити склад
        </a>
      `,
    });
  }
}
