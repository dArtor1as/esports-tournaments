import { Bracket, Stage } from '@prisma/client';
import { mock, MockProxy, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { GroupStageGenerator } from './group-stage.generator';
import { PrismaService } from 'src/prisma/prisma.service';
import { HeuristicSeedingService } from '../heuristic-seeding.service';
import type {
  MatchPayload,
  ParticipantInput,
} from './bracket-generator.interface';

describe('GroupStageGenerator', () => {
  let generator: GroupStageGenerator;
  let prisma: DeepMockProxy<PrismaService>;
  let seeding: MockProxy<HeuristicSeedingService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    seeding = mock<HeuristicSeedingService>();
    generator = new GroupStageGenerator(prisma, seeding);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when teams cannot be split evenly', async () => {
    await expect(generator.generate('t1', 5, [], 'TEAM', 2)).rejects.toThrow(
      'Неможливо розділити 5 команд на 2 груп порівну.',
    );
  });

  it('throws when groups are not even', async () => {
    await expect(generator.generate('t1', 6, [], 'TEAM', 2)).rejects.toThrow(
      'У кожній групі має бути парна кількість команд. Зараз виходить по 3 команд у групі. Будь ласка, оберіть іншу кількість груп.',
    );
  });

  it('creates group stage matches', async () => {
    const participants: ParticipantInput[] = [
      {
        id: 'p1',
        teamId: 'team-a',
        team: { id: 'team-a', name: 'A', region: 'EU', averageRating: 1000 },
      },
      {
        id: 'p2',
        teamId: 'team-b',
        team: { id: 'team-b', name: 'B', region: 'EU', averageRating: 1000 },
      },
      {
        id: 'p3',
        teamId: 'team-c',
        team: { id: 'team-c', name: 'C', region: 'EU', averageRating: 1000 },
      },
      {
        id: 'p4',
        teamId: 'team-d',
        team: { id: 'team-d', name: 'D', region: 'EU', averageRating: 1000 },
      },
    ];

    seeding.generateOptimalGroups.mockReturnValueOnce([
      [
        { id: 'team-a', name: 'A', rating: 1000, region: 'EU' },
        { id: 'team-b', name: 'B', rating: 1000, region: 'EU' },
      ],
      [
        { id: 'team-c', name: 'C', rating: 1000, region: 'EU' },
        { id: 'team-d', name: 'D', rating: 1000, region: 'EU' },
      ],
    ]);

    const createManySpy = jest.spyOn(prisma.match, 'createMany');
    const updateSpy = jest.spyOn(prisma.tournament, 'update');

    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
    prisma.match.findMany.mockResolvedValueOnce([]);

    await generator.generate('t1', 4, participants, 'TEAM', 2);

    const createArgs = createManySpy.mock.calls[0]?.[0];
    expect(createArgs).toBeDefined();
    const created = createArgs!.data as MatchPayload[];

    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      stage: Stage.GROUP,
      bracket: Bracket.NONE,
      bestOf: 3,
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'live' },
    });
  });
});
