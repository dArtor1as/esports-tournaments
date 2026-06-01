import {
  HeuristicSeedingService,
  TeamForSeeding,
} from './heuristic-seeding.service';

describe('HeuristicSeedingService', () => {
  let service: HeuristicSeedingService;

  beforeEach(() => {
    service = new HeuristicSeedingService();
  });

  it('throws when teams cannot be divided evenly', () => {
    const teams: TeamForSeeding[] = [
      { id: '1', name: 'A', rating: 1000, region: 'EU' },
      { id: '2', name: 'B', rating: 900, region: 'EU' },
      { id: '3', name: 'C', rating: 800, region: 'EU' },
    ];

    expect(() => service.generateOptimalGroups(teams, 2)).toThrow(
      'Кількість команд має ділитися на кількість груп порівну',
    );
  });

  it('returns groups with expected size', () => {
    const teams: TeamForSeeding[] = [
      { id: '1', name: 'A', rating: 1200, region: 'EU' },
      { id: '2', name: 'B', rating: 1100, region: 'EU' },
      { id: '3', name: 'C', rating: 1000, region: 'NA' },
      { id: '4', name: 'D', rating: 900, region: 'NA' },
    ];

    const groups = service.generateOptimalGroups(teams, 2);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(2);
    expect(
      groups
        .flat()
        .map((team) => team.id)
        .sort(),
    ).toEqual(teams.map((team) => team.id).sort());
  });
});
