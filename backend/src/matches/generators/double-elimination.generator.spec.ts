import { Bracket, Stage } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DoubleEliminationGenerator } from './double-elimination.generator';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  MatchPayload,
  ParticipantInput,
} from './bracket-generator.interface';

describe('DoubleEliminationGenerator', () => {
  let generator: DoubleEliminationGenerator;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    generator = new DoubleEliminationGenerator(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates double elimination bracket and grand final', async () => {
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
    const grandFinal = created.find(
      (match) => match.bracket === Bracket.GRAND_FINAL,
    );

    expect(created).toHaveLength(6);
    expect(grandFinal).toMatchObject({
      stage: Stage.PLAYOFF,
      bestOf: 5,
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'live' },
    });
  });
});
