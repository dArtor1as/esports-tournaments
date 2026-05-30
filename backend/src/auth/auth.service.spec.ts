import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

jest.mock('bcryptjs', () => ({
  compare: jest.fn<Promise<boolean>, [string, string]>(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: MockProxy<UsersService>;
  let jwtService: MockProxy<JwtService>;

  beforeEach(async () => {
    usersService = mock<UsersService>();
    jwtService = mock<JwtService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('throws when user not found', async () => {
      const dto: LoginDto = { email: 'missing@example.com', password: 'pass' };
      const findByEmailSpy = jest.spyOn(usersService, 'findByEmail');

      usersService.findByEmail.mockResolvedValueOnce(null);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Невірний email або пароль'),
      );
      expect(findByEmailSpy).toHaveBeenCalledWith(dto.email);
    });

    it('throws when password is invalid', async () => {
      const dto: LoginDto = { email: 'user@example.com', password: 'wrong' };
      const findByEmailSpy = jest.spyOn(usersService, 'findByEmail');
      const compareMock = bcrypt.compare as jest.Mock<
        Promise<boolean>,
        [string, string]
      >;

      usersService.findByEmail.mockResolvedValueOnce({
        id: 'u1',
        email: dto.email,
        username: 'user1',
        role: Role.USER,
        passwordHash: 'hash',
      } as never);
      compareMock.mockReturnValueOnce(Promise.resolve(false));

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Невірний email або пароль'),
      );
      expect(findByEmailSpy).toHaveBeenCalledWith(dto.email);
      expect(compareMock).toHaveBeenCalledWith(dto.password, 'hash');
    });

    it('returns token and user on success', async () => {
      const dto: LoginDto = { email: 'user@example.com', password: 'pass' };
      const findByEmailSpy = jest.spyOn(usersService, 'findByEmail');
      const compareMock = bcrypt.compare as jest.Mock<
        Promise<boolean>,
        [string, string]
      >;
      const signSpy = jest.spyOn(jwtService, 'sign');

      usersService.findByEmail.mockResolvedValueOnce({
        id: 'u1',
        email: dto.email,
        username: 'user1',
        role: Role.USER,
        passwordHash: 'hash',
      } as never);
      compareMock.mockReturnValueOnce(Promise.resolve(true));
      jwtService.sign.mockReturnValueOnce('token');

      await expect(service.login(dto)).resolves.toEqual({
        message: 'Успішний вхід',
        accessToken: 'token',
        user: { id: 'u1', username: 'user1', role: Role.USER },
      });

      expect(findByEmailSpy).toHaveBeenCalledWith(dto.email);
      expect(compareMock).toHaveBeenCalledWith(dto.password, 'hash');
      expect(signSpy).toHaveBeenCalledWith({
        sub: 'u1',
        email: dto.email,
        role: Role.USER,
      });
    });
  });
});
