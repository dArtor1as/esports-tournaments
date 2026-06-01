import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TournamentsController', () => {
  let controller: TournamentsController;
  let tournamentsService: MockProxy<TournamentsService>;

  const user: JwtPayload = {
    userId: 'user-1',
    email: 'user-1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    tournamentsService = mock<TournamentsService>();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentsController],
      providers: [
        { provide: TournamentsService, useValue: tournamentsService },
      ],
    }).compile();

    controller = module.get<TournamentsController>(TournamentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates a tournament via service', async () => {
    const dto = {
      title: 'Cup',
      gameId: 'game-1',
      tier: 2,
      kFactor: 0.6,
      isPublic: true,
    };
    const createSpy = jest
      .spyOn(tournamentsService, 'create')
      .mockResolvedValue({ id: 't1' } as never);

    const result = await controller.create(dto as never, user);

    expect(createSpy).toHaveBeenCalledWith(dto, user.userId);
    expect(result).toHaveProperty('id');
  });

  it('finishes tournament via service', async () => {
    const finishSpy = jest
      .spyOn(tournamentsService, 'finishTournament')
      .mockResolvedValue({ message: 'done' } as never);

    const result = await controller.finish('t1', user);

    expect(finishSpy).toHaveBeenCalledWith('t1', user);
    expect(result).toHaveProperty('message');
  });

  it('removes tournament via service', async () => {
    const removeSpy = jest
      .spyOn(tournamentsService, 'remove')
      .mockResolvedValue({ id: 't1' } as never);

    const result = await controller.remove('t1', user);

    expect(removeSpy).toHaveBeenCalledWith('t1', user);
    expect(result).toHaveProperty('id');
  });

  it('cancels tournament via service', async () => {
    const cancelSpy = jest
      .spyOn(tournamentsService, 'cancelTournament')
      .mockResolvedValue({ message: 'cancelled' } as never);

    const result = await controller.cancelTournament('t1', user);

    expect(cancelSpy).toHaveBeenCalledWith('t1', user);
    expect(result.message).toEqual('cancelled');
  });
});
