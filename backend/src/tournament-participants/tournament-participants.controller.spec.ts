import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TournamentParticipantsController } from './tournament-participants.controller';
import { TournamentParticipantsService } from './tournament-participants.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TournamentParticipantsController', () => {
  let controller: TournamentParticipantsController;
  let service: MockProxy<TournamentParticipantsService>;

  const user: JwtPayload = {
    userId: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    service = mock<TournamentParticipantsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentParticipantsController],
      providers: [
        { provide: TournamentParticipantsService, useValue: service },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<TournamentParticipantsController>(
      TournamentParticipantsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delegates to service', async () => {
    const dto = {
      tournamentId: 't1',
      teamId: 'team1',
      rosterPlayerIds: ['p1'],
    };
    service.create.mockResolvedValueOnce({ id: 'participant-1' } as never);

    const result = await controller.create(dto, user);

    expect(service.create.mock.calls[0]).toEqual([dto, user]);
    expect(result).toEqual({ id: 'participant-1' });
  });

  it('findAllByTournament delegates to service', async () => {
    service.findAllByTournament.mockResolvedValueOnce([]);

    const result = await controller.findAllByTournament('t1');

    expect(service.findAllByTournament.mock.calls[0]).toEqual(['t1']);
    expect(result).toEqual([]);
  });

  it('remove delegates to service', async () => {
    service.remove.mockResolvedValueOnce({ id: 'participant-1' } as never);

    const result = await controller.remove('part-1', user);

    expect(service.remove.mock.calls[0]).toEqual(['part-1', user]);
    expect(result).toEqual({ id: 'participant-1' });
  });
});
