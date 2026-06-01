import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep, MockProxy } from 'jest-mock-extended';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from 'src/auth/access-policy.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;
  let accessPolicy: MockProxy<AccessPolicyService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    accessPolicy = mockDeep<AccessPolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccessPolicyService, useValue: accessPolicy },
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
    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('u1', { id: 'u1' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('checks access and deletes user', async () => {
      const checkSelfOrAdminSpy = jest.spyOn(accessPolicy, 'checkSelfOrAdmin');
      const deleteSpy = jest.spyOn(prisma.user, 'delete');
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' } as never);
      prisma.user.delete.mockResolvedValueOnce({ id: 'u1' } as never);

      await expect(
        service.remove('u1', {
          id: 'u1',
          role: Role.ADMIN,
        } as never),
      ).resolves.toEqual({ id: 'u1' });

      expect(checkSelfOrAdminSpy).toHaveBeenCalledWith('u1', {
        id: 'u1',
        role: Role.ADMIN,
      });
      expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });
});
