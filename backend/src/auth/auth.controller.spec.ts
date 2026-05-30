import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: MockProxy<AuthService>;

  beforeEach(async () => {
    authService = mock<AuthService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('login delegates to service', async () => {
    const dto: LoginDto = {
      email: 'user@example.com',
      password: 'pass',
    };
    const loginSpy = jest.spyOn(authService, 'login');

    authService.login.mockResolvedValueOnce({
      message: 'Успішний вхід',
      accessToken: 'token',
      user: { id: 'u1', username: 'user1', role: Role.USER },
    } as never);

    await expect(controller.login(dto)).resolves.toEqual({
      message: 'Успішний вхід',
      accessToken: 'token',
      user: { id: 'u1', username: 'user1', role: Role.USER },
    });

    expect(loginSpy).toHaveBeenCalledWith(dto);
  });
});
