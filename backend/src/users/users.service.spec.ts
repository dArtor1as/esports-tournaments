import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MailService } from 'src/mail/mail.service';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;
  let cacheManager: MockProxy<Cache>;
  let mailService: MockProxy<MailService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mockDeep<AccessPolicyService>();
    cacheManager = mock<Cache>();
    mailService = mock<MailService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('throws if email already exists', async () => {
      const dto: CreateUserDto = {
        username: 'user1',
        email: 'user1@example.com',
        password: 'password123',
      };

      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' } as never);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('throws if username already exists', async () => {
      const dto: CreateUserDto = {
        username: 'user1',
        email: 'user1@example.com',
        password: 'password123',
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'u1' } as never);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('creates user with hashed password and normalized fields', async () => {
      const dto: CreateUserDto = {
        username: 'user1',
        email: 'user1@example.com',
        password: 'password123',
        role: Role.USER,
        countryCode: 'ua',
        birthDate: '2000-11-09',
      };
      const createSpy = jest.spyOn(prisma.user, 'create');

      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 'u1',
        username: dto.username,
        email: dto.email,
        role: dto.role,
        createdAt: new Date(),
        countryCode: 'UA',
        birthDate: new Date(dto.birthDate!),
      } as never);

      await expect(service.create(dto)).resolves.toMatchObject({
        email: dto.email,
      });

      const [createArgs] = createSpy.mock.calls[0];

      expect(createArgs.data).toMatchObject({
        countryCode: 'UA',
        birthDate: new Date(dto.birthDate!),
      });
      expect(createArgs.data.passwordHash).toEqual(expect.any(String));
    });
  });

  describe('findAll', () => {
    it('returns a list of users', async () => {
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }] as never);
      await expect(service.findAll()).resolves.toEqual([{ id: 'u1' }]);
    });
  });

  describe('findOne', () => {
    it('returns a specific user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' } as never);
      await expect(service.findOne('u1')).resolves.toEqual({ id: 'u1' });
    });
  });

  describe('findByEmail', () => {
    it('returns user by email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' } as never);
      await expect(service.findByEmail('test@test.com')).resolves.toEqual({
        id: 'u1',
      });
    });
  });

  describe('getMe', () => {
    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.getMe('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns user profile when found', async () => {
      const findUniqueSpy = jest.spyOn(prisma.user, 'findUnique');
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        username: 'user1',
        email: 'user1@example.com',
        role: Role.USER,
        countryCode: 'UA',
        birthDate: null,
        players: [],
      } as never);

      await expect(service.getMe('u1')).resolves.toMatchObject({ id: 'u1' });

      const [findUniqueArgs] = findUniqueSpy.mock.calls[0];

      expect(findUniqueArgs).toMatchObject({ where: { id: 'u1' } });
    });
  });

  describe('requestDeletionCode', () => {
    const mockUser = { userId: 'u1', role: Role.USER } as unknown as JwtPayload;

    it('throws if user not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.requestDeletionCode('u1', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('generates code, caches it and sends email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 't@t.com',
      } as never);
      const cacheSetSpy = jest.spyOn(cacheManager, 'set');
      const mailSpy = jest.spyOn(mailService, 'sendAccountDeletionCode');

      await expect(
        service.requestDeletionCode('u1', mockUser),
      ).resolves.toEqual({
        message: 'Код відправлено на пошту',
      });

      expect(cacheSetSpy).toHaveBeenCalledWith(
        'delete_code_u1',
        expect.any(String),
        900000,
      );
      expect(mailSpy).toHaveBeenCalledWith('t@t.com', expect.any(String));
    });
  });

  describe('update', () => {
    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('u1', { username: 'new' }, { id: 'u1' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('checks access and updates user', async () => {
      const dto: UpdateUserDto = { username: 'new' };
      const checkSelfOrAdminSpy = jest.spyOn(accessPolicy, 'checkSelfOrAdmin');
      const updateSpy = jest.spyOn(prisma.user, 'update');

      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' } as never);
      prisma.user.update.mockResolvedValueOnce({ id: 'u1' } as never);

      await service.update('u1', dto, { id: 'u1', role: Role.USER } as never);

      expect(checkSelfOrAdminSpy).toHaveBeenCalledWith('u1', {
        id: 'u1',
        role: Role.USER,
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: dto,
      });
    });
  });

  describe('remove', () => {
    const mockUser = { userId: 'u1', role: Role.USER } as unknown as JwtPayload;

    it('throws when code is invalid', async () => {
      // Спочатку перевіряємо невірний код (кеш повертає null або інший код)
      cacheManager.get.mockResolvedValueOnce('wrong-code');

      await expect(service.remove('u1', mockUser, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when user not found', async () => {
      // Щоб дійти до перевірки юзера в БД, кеш має повернути правильний код
      cacheManager.get.mockResolvedValueOnce('123456');
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('u1', mockUser, '123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if account is already deleted', async () => {
      cacheManager.get.mockResolvedValueOnce('123456');
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        deletedAt: new Date(),
      } as never);

      await expect(service.remove('u1', mockUser, '123456')).rejects.toThrow(
        ConflictException,
      );
    });

    it('reassigns captain in teams for users players', async () => {
      cacheManager.get.mockResolvedValue('123456');
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));

      // Юзер має ігровий профіль, який знаходиться в команді
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        players: [{ id: 'p1', teamId: 't1' }],
      } as never);

      // Мок пошуку команди
      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p1',
        players: [{ id: 'p1' }, { id: 'p2' }],
      } as never);

      const updateTeamSpy = jest.spyOn(prisma.team, 'update');

      await service.remove('u1', mockUser, '123456');

      // Перевірка перепризначення в межах видалення юзера
      expect(updateTeamSpy).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { captainId: 'p2' },
      });
    });

    it('disbands team if users player was the last one', async () => {
      cacheManager.get.mockResolvedValue('123456');
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        players: [{ id: 'p1', teamId: 't1' }],
      } as never);

      prisma.team.findUnique.mockResolvedValueOnce({
        id: 't1',
        captainId: 'p1',
        players: [{ id: 'p1' }], // Тільки один гравець
      } as never);

      const updateTeamSpy = jest.spyOn(prisma.team, 'update');

      await service.remove('u1', mockUser, '123456');

      // Перевірка розпуску команди
      expect(updateTeamSpy).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'DISBANDED' },
      });
    });

    it('checks access and anonymizes user', async () => {
      const checkSelfOrAdminSpy = jest.spyOn(accessPolicy, 'checkSelfOrAdmin');

      // Використовуємо mockResolvedValue
      // бо кеш викликається двічі для не-адмінів
      cacheManager.get.mockResolvedValue('123456');

      //  Додаємо players
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        players: [],
      } as never);

      prisma.$transaction.mockImplementation(async (cb) => cb(prisma as never));
      prisma.user.update.mockResolvedValueOnce({ id: 'u1' } as never);

      await expect(service.remove('u1', mockUser, '123456')).resolves.toEqual({
        //  Точний текст повідомлення
        message: 'Акаунт успішно анонімізовано',
      });

      expect(checkSelfOrAdminSpy).toHaveBeenCalledWith('u1', mockUser);
    });
  });
});
