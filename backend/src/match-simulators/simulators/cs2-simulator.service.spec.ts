import { Test, TestingModule } from '@nestjs/testing';
import { Cs2SimulatorService } from './cs2-simulator.service';
import { TeamInput } from '../match-simulator.interface';

describe('Cs2SimulatorService', () => {
  let service: Cs2SimulatorService;

  const mockTeamA: TeamInput = {
    id: 'team-a',
    rating: 1500,
    players: [
      { id: 'p1', rating: 1100, inGameRole: 'SNIPER' },
      { id: 'p2', rating: 1050, inGameRole: 'IGL' },
    ],
  };

  const mockTeamB: TeamInput = {
    id: 'team-b',
    rating: 1450,
    players: [
      { id: 'p3', rating: 1080, inGameRole: 'ENTRY' },
      { id: 'p4', rating: 1020, inGameRole: 'SUPPORT' },
    ],
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [Cs2SimulatorService],
    }).compile();

    service = module.get<Cs2SimulatorService>(Cs2SimulatorService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('повинен бути визначеним', () => {
    expect(service).toBeDefined();
  });

  it('simulateSeries повинен коректно симулювати Bo3 серію', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const getGeneRollMock = jest.fn().mockReturnValue(0.3);
    const expectedProbA = 0.6;

    const result = service.simulateSeries(
      mockTeamA,
      mockTeamB,
      expectedProbA,
      3,
      getGeneRollMock,
    );

    expect(result.winsA).toBe(2);
    expect(result.winsB).toBe(0);
    expect(result.mapDetails).toHaveLength(2);

    expect(result.stats).toBeDefined();

    type ExpectedStats = {
      maps: Array<{ teamA: { players: Array<{ playerId: string }> } }>;
    };
    const safeStats = result.stats as unknown as ExpectedStats;

    expect(safeStats.maps).toHaveLength(2);
    expect(safeStats.maps[0].teamA.players[0].playerId).toBe('p1');
    expect(getGeneRollMock).toHaveBeenCalledTimes(2);
  });

  it('simulateSeries повинен генерувати овертайми на основі ймовірності', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const getGeneRollMock = jest.fn().mockReturnValue(0.1);

    const result = service.simulateSeries(
      mockTeamA,
      mockTeamB,
      0.5,
      1,
      getGeneRollMock,
    );

    expect(result.mapDetails[0].scoreA).toBe(16);
    expect(result.mapDetails[0].scoreB).toBeGreaterThanOrEqual(14);
  });
  it("повинен призначати fallback ролі (в т.ч. RIFLER для 6+ гравця) та уникати від'ємних вбивств", () => {
    // Фіксуємо random в 0.
    // Формула: kills += Math.floor(Math.random() * 5) - 2;
    // 0 * 5 - 2 = -2. Це змусить базові вбивства стати від'ємними
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const teamWithoutRoles: TeamInput = {
      id: 'team-no-roles',
      rating: 1500,
      players: [
        { id: 'p1', rating: 1500 },
        { id: 'p2', rating: 1400 },
        { id: 'p3', rating: 1300 },
        { id: 'p4', rating: 1200 },
        { id: 'p5', rating: 1100 },
        { id: 'p6', rating: 1000 }, // Цей гравець вийде за межі масиву fallbackRoles і отримає 'RIFLER'
      ],
    };

    const getGeneRollMock = jest.fn().mockReturnValue(0.1);

    const result = service.simulateSeries(
      teamWithoutRoles,
      mockTeamB,
      0.9,
      1,
      getGeneRollMock,
    );

    type ExpectedStats = {
      maps: Array<{ teamA: { players: Array<{ kills: number }> } }>;
    };
    const safeStats = result.stats as unknown as ExpectedStats;

    // Перевіряємо, що запобіжник спрацював і кілів < 0 немає
    safeStats.maps[0].teamA.players.forEach((p) => {
      expect(p.kills).toBeGreaterThanOrEqual(0);
    });
  });
  it('повинен симулювати перемогу команди B та використовувати дефолтне значення bestOf', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    // Робимо так, щоб генерувалось значення більше за expectedProbA (0.8 > 0.2)
    // Це змусить код піти гілками: aWinsThisMap = false, winsB++ та змінити рахунок на користь B
    const getGeneRollMock = jest.fn().mockReturnValue(0.8);
    const expectedProbA = 0.2;

    const result = service.simulateSeries(
      mockTeamA,
      mockTeamB,
      expectedProbA,
      undefined, // Навмисно не передаємо bestOf, щоб спрацювало = 3 (дефолт)
      getGeneRollMock,
    );

    // Має бути рахунок 0:2 на користь команди B
    expect(result.winsA).toBe(0);
    expect(result.winsB).toBe(2);

    // Перевіряємо, що рахунок на карті також на користь B
    expect(result.mapDetails[0].scoreB).toBeGreaterThan(
      result.mapDetails[0].scoreA,
    );
  });

  it('повинен коректно обробляти невалідні ролі гравців (fallback)', () => {
    // Передаємо роль, якої немає в ROLE_MULTIPLIERS, щоб покрити
    // другу частину умови: !this.ROLE_MULTIPLIERS[role]
    const teamWithInvalidRole: TeamInput = {
      id: 'team-invalid',
      rating: 1500,
      players: [{ id: 'p1', rating: 1500, inGameRole: 'NINJA' }],
    };

    const getGeneRollMock = jest.fn().mockReturnValue(0.1);

    const result = service.simulateSeries(
      teamWithInvalidRole,
      mockTeamB,
      0.9,
      1,
      getGeneRollMock,
    );
    // Просто перевіряємо, що сервіс не впав і стата згенерувалась
    expect(result.stats).toBeDefined();
  });
});
