import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TournamentsWorkflowController } from './tournaments-workflow.controller';
import { TournamentsWorkflowService } from './tournaments-workflow.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TournamentsWorkflowController', () => {
  let controller: TournamentsWorkflowController;
  let workflowService: MockProxy<TournamentsWorkflowService>;

  const user: JwtPayload = {
    userId: 'user-1',
    email: 'user-1@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    workflowService = mock<TournamentsWorkflowService>();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentsWorkflowController],
      providers: [
        { provide: TournamentsWorkflowService, useValue: workflowService },
        { provide: CACHE_MANAGER, useValue: {} }, // ВИПРАВЛЕНО: додано Cache Manager
      ],
    }).compile();

    controller = module.get<TournamentsWorkflowController>(
      TournamentsWorkflowController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns workflow data via service', async () => {
    const response = [{ id: 't1' }];
    workflowService.findWorkflow.mockResolvedValueOnce(response as never);

    const result = await controller.findWorkflow('generation', 'planned');

    expect(workflowService.findWorkflow.mock.calls[0]).toEqual([
      'generation',
      'planned',
    ]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('generates test tournament via service', async () => {
    const response = { tournamentId: 't1' };
    workflowService.generateTestTournament.mockResolvedValueOnce(
      response as never,
    );

    const result = await controller.generateTestTournament(
      { title: 'Test Cup', teamCount: 8, isPublic: true },
      user,
    );

    expect(workflowService.generateTestTournament.mock.calls[0]).toEqual([
      { title: 'Test Cup', teamCount: 8, isPublic: true },
      'user-1',
    ]);
    expect(result).toHaveProperty('tournamentId');
  });
});
