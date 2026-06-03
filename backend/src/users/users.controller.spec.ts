import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: MockProxy<UsersService>;

  beforeEach(async () => {
    usersService = mock<UsersService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delegates to service', async () => {
    const dto: CreateUserDto = {
      username: 'user1',
      email: 'user1@example.com',
      password: 'password123',
    };
    const createSpy = jest.spyOn(usersService, 'create');

    usersService.create.mockResolvedValueOnce({ id: 'u1' } as never);

    await expect(controller.create(dto)).resolves.toEqual({ id: 'u1' });

    expect(createSpy).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to service', async () => {
    const findAllSpy = jest.spyOn(usersService, 'findAll');
    usersService.findAll.mockResolvedValueOnce([{ id: 'u1' }] as never);

    await expect(controller.findAll()).resolves.toEqual([{ id: 'u1' }]);

    expect(findAllSpy).toHaveBeenCalledTimes(1);
  });

  it('getMe delegates to service', async () => {
    const user = { userId: 'u1' } as JwtPayload;
    const getMeSpy = jest.spyOn(usersService, 'getMe');
    usersService.getMe.mockResolvedValueOnce({ id: 'u1' } as never);

    await expect(controller.getMe(user)).resolves.toEqual({ id: 'u1' });

    expect(getMeSpy).toHaveBeenCalledWith('u1');
  });

  it('findOne delegates to service', async () => {
    const findOneSpy = jest.spyOn(usersService, 'findOne');
    usersService.findOne.mockResolvedValueOnce({ id: 'u1' } as never);

    await expect(controller.findOne('u1')).resolves.toEqual({ id: 'u1' });

    expect(findOneSpy).toHaveBeenCalledWith('u1');
  });

  it('update delegates to service', async () => {
    const dto: UpdateUserDto = { username: 'new' };
    const user = { userId: 'u1', role: Role.USER } as JwtPayload;
    const updateSpy = jest.spyOn(usersService, 'update');
    usersService.update.mockResolvedValueOnce({ id: 'u1' } as never);

    await expect(controller.update('u1', dto, user)).resolves.toEqual({
      id: 'u1',
    });

    expect(updateSpy).toHaveBeenCalledWith('u1', dto, user);
  });

  it('remove delegates to service', async () => {
    const user = { userId: 'u1', role: Role.ADMIN } as JwtPayload;
    const removeSpy = jest.spyOn(usersService, 'remove');
    usersService.remove.mockResolvedValueOnce({ message: 'ok' } as never);

    await expect(controller.remove('u1', user, '123456')).resolves.toEqual({
      message: 'ok',
    });

    // Очікуваний виклик до сервісу (саме в такому порядку Jest отримав аргументи)
    expect(removeSpy).toHaveBeenCalledWith('u1', user, '123456');
  });

  it('requestDeletionCode delegates to service', async () => {
    const user = { userId: 'u1' } as JwtPayload;
    const requestSpy = jest.spyOn(usersService, 'requestDeletionCode');
    usersService.requestDeletionCode.mockResolvedValueOnce({ message: 'ok' });

    await expect(controller.requestDeletionCode('u1', user)).resolves.toEqual({
      message: 'ok',
    });

    expect(requestSpy).toHaveBeenCalledWith('u1', user);
  });
});
