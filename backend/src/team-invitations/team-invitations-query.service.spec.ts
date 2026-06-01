import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Prisma } from '@prisma/client';
import { TeamInvitationsQueryService } from './team-invitations-query.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TeamInvitationsQueryService', () => {
  let service: TeamInvitationsQueryService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamInvitationsQueryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TeamInvitationsQueryService>(
      TeamInvitationsQueryService,
    );
  });

  it('findAll викликає prisma.findMany без умов', async () => {
    prisma.teamInvitation.findMany.mockResolvedValueOnce([]);
    await service.findAll();
    expect(prisma.teamInvitation.findMany.mock.calls.length).toBe(1);
    expect(prisma.teamInvitation.findMany.mock.calls[0][0]).toBeUndefined();
  });

  it('findMyInvites викликає prisma з правильними умовами', async () => {
    prisma.teamInvitation.findMany.mockResolvedValueOnce([]);
    await service.findMyInvites('u1');
    const callArgs = prisma.teamInvitation.findMany.mock
      .calls[0][0] as Prisma.TeamInvitationFindManyArgs;
    expect(callArgs.where?.userId).toBe('u1');
    expect(callArgs.where?.status).toBe('PENDING');
  });
});
