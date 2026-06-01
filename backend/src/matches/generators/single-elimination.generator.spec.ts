import { Bracket, Stage } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SingleEliminationGenerator } from './single-elimination.generator';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  MatchPayload,
  ParticipantInput,
} from './bracket-generator.interface';

describe('SingleEliminationGenerator', () => {
  let generator: SingleEliminationGenerator;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    generator = new SingleEliminationGenerator(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates playoff matches and assigns teams', async () => {
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

    const createManySpy = jest.spyOn(prisma.match, 'createMany');
    const updateSpy = jest.spyOn(prisma.tournament, 'update');

    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
    prisma.match.findMany.mockResolvedValueOnce([]);

    await generator.generate('t1', 4, participants, 'TEAM');

    const createArgs = createManySpy.mock.calls[0]?.[0];
    expect(createArgs).toBeDefined();
    const created = createArgs!.data as MatchPayload[];
    const round1 = created.filter((match) => match.round === 1);

    expect(created).toHaveLength(3);
    expect(round1).toHaveLength(2);
    expect(round1[0]).toMatchObject({
      stage: Stage.PLAYOFF,
      bracket: Bracket.UPPER,
      bestOf: 3,
      teamAId: 'team-a',
      teamBId: 'team-d',
    });
    expect(round1[1]).toMatchObject({
      teamAId: 'team-b',
      teamBId: 'team-c',
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'live' },
    });
  });
});
