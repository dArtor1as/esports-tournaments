import { Test, TestingModule } from '@nestjs/testing';
import { Dota2SimulatorService } from './dota2-simulator.service';
import { TeamInput } from '../match-simulator.interface';

describe('Dota2SimulatorService', () => {
  let service: Dota2SimulatorService;

  const mockTeamA: TeamInput = {
    id: 'team-a',
    rating: 1500,
    players: [
      { id: 'p1', rating: 2000, inGameRole: 'POS_1' },
      { id: 'p2', rating: 1900, inGameRole: 'POS_5' },
    ],
  };

  const mockTeamB: TeamInput = {
    id: 'team-b',
    rating: 1450, // Додано рейтинг команди
    players: [
      { id: 'p3', rating: 1950, inGameRole: 'POS_2' },
      { id: 'p4', rating: 1850, inGameRole: 'POS_4' },
    ],
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [Dota2SimulatorService],
    }).compile();

    service = module.get<Dota2SimulatorService>(Dota2SimulatorService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('simulateSeries повинен коректно симулювати Bo3 серію', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const getGeneRollMock = jest.fn().mockReturnValue(0.8);
    const expectedProbA = 0.4;

    const result = service.simulateSeries(
      mockTeamA,
      mockTeamB,
      expectedProbA,
      3,
      getGeneRollMock,
    );

    expect(result.winsA).toBe(0);
    expect(result.winsB).toBe(2);
    expect(result.mapDetails).toHaveLength(2);
    expect(result.mapDetails[0].map).toBe('Game 1');
    expect(result.mapDetails[1].map).toBe('Game 2');

    type ExpectedStats = {
      maps: Array<{ teamA: { players: Array<{ gpm: number }> } }>;
    };
    const safeStats = result.stats as unknown as ExpectedStats;

    expect(safeStats.maps).toHaveLength(2);
    expect(safeStats.maps[0].teamA.players[0].gpm).toBeGreaterThan(0);
  });

  it('повинен автоматично призначати fallback ролі, якщо вони не передані', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const getGeneRollMock = jest.fn().mockReturnValue(0.1);

    const teamWithoutRoles: TeamInput = {
      id: 'team-no-roles',
      rating: 1500,
      players: [
        { id: 'p1', rating: 2500 },
        { id: 'p2', rating: 1000 },
      ],
    };

    const result = service.simulateSeries(
      teamWithoutRoles,
      mockTeamB,
      0.9,
      1,
      getGeneRollMock,
    );

    type ExpectedStats = {
      maps: Array<{
        teamA: {
          players: Array<{ playerId: string; gpm: number; netWorth: number }>;
        };
      }>;
    };
    const safeStats = result.stats as unknown as ExpectedStats;

    const p1Stats = safeStats.maps[0].teamA.players.find(
      (p) => p.playerId === 'p1',
    );
    const p2Stats = safeStats.maps[0].teamA.players.find(
      (p) => p.playerId === 'p2',
    );

    // Використовуємо fallback значення (0), щоб уникнути помилок типізації undefined
    const p1Gpm = p1Stats?.gpm ?? 0;
    const p2Gpm = p2Stats?.gpm ?? 0;
    const p1NetWorth = p1Stats?.netWorth ?? 0;
    const p2NetWorth = p2Stats?.netWorth ?? 0;

    expect(p1Gpm).toBeGreaterThan(p2Gpm);
    expect(p1NetWorth).toBeGreaterThan(p2NetWorth);
  });
  it("повинен призначати дефолтний POS_5 для 6+ гравців та уникати від'ємних вбивств", () => {
    // Фіксуємо random в 0.
    // Формула: kills += Math.floor(Math.random() * 3) - 1;
    // 0 * 3 - 1 = -1. Це викличе гілку if (kills < 0) kills = 0;
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const teamLarge: TeamInput = {
      id: 'team-large',
      rating: 1500,
      players: [
        { id: 'p1', rating: 2000 },
        { id: 'p2', rating: 1900 },
        { id: 'p3', rating: 1800 },
        { id: 'p4', rating: 1700 },
        { id: 'p5', rating: 1600 },
        { id: 'p6', rating: 1500 }, // Отримає POS_5 за замовчуванням
      ],
    };

    const getGeneRollMock = jest.fn().mockReturnValue(0.1);

    const result = service.simulateSeries(
      teamLarge,
      mockTeamB,
      0.9,
      1,
      getGeneRollMock,
    );

    type ExpectedStats = {
      maps: Array<{ teamA: { players: Array<{ kills: number }> } }>;
    };
    const safeStats = result.stats as unknown as ExpectedStats;

    // Перевіряємо гілку захисту від від'ємних значень
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
    // (значить, fallback успішно спрацював)
    expect(result.stats).toBeDefined();
  });
});
