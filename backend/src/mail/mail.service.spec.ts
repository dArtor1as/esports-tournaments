import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

// 1. Створюємо строгий тип для аргументів функції sendMail
type SendMailArgs = { to: string; subject: string; html: string };

describe('MailService', () => {
  let service: MailService;
  // 2. Строго типізуємо моки
  let mailerServiceMock: { sendMail: jest.Mock<Promise<void>, [SendMailArgs]> };
  let configServiceMock: { get: jest.Mock<string, [string]> };

  beforeEach(async () => {
    mailerServiceMock = {
      sendMail: jest.fn<Promise<void>, [SendMailArgs]>(),
    };

    configServiceMock = {
      get: jest.fn<string, [string]>().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailerServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendTeamInvite', () => {
    it('відправляє лист із запрошенням в команду', async () => {
      await service.sendTeamInvite('test@test.com', 'Navi', 'token123');

      expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);

      // Тепер args має строгий тип SendMailArgs
      const args = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(args.to).toBe('test@test.com');
      expect(args.subject).toContain('Navi');
      expect(args.html).toContain(
        'http://localhost:3000/invite/team?token=token123',
      );
    });
  });

  describe('sendMatchDisputeNotification', () => {
    it('відправляє лист про конфлікт', async () => {
      await service.sendMatchDisputeNotification(
        'admin@test.com',
        'IEM',
        'm1',
        'Чіти',
      );

      expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);

      const args = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(args.to).toBe('admin@test.com');
      expect(args.subject).toContain('IEM');
      expect(args.html).toContain('http://localhost:3000/matches/m1');
      expect(args.html).toContain('Чіти');
    });
  });

  describe('sendTournamentInvite', () => {
    it('відправляє лист із запрошенням на турнір', async () => {
      await service.sendTournamentInvite(
        'cap@test.com',
        'Major',
        'Navi',
        'token123',
      );

      expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);

      const args = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(args.to).toBe('cap@test.com');
      expect(args.subject).toContain('Major');
      expect(args.html).toContain('Navi');
      expect(args.html).toContain(
        'http://localhost:3000/invite/tournament?token=token123',
      );
    });
  });
  describe('sendAccountDeletionCode', () => {
    it('відправляє лист із кодом підтвердження видалення акаунту', async () => {
      await service.sendAccountDeletionCode('user@test.com', '123456');

      expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);

      const args = mailerServiceMock.sendMail.mock.calls[0][0];
      expect(args.to).toBe('user@test.com');
      expect(args.subject).toContain('Код підтвердження видалення акаунту');
      expect(args.html).toContain('123456');
    });
  });
});
