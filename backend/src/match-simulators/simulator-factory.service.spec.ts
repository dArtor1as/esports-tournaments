import { Test, TestingModule } from '@nestjs/testing';
import { NotImplementedException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { SimulatorFactoryService } from './simulator-factory.service';
import { Cs2SimulatorService } from './simulators/cs2-simulator.service';
import { Dota2SimulatorService } from './simulators/dota2-simulator.service';

describe('SimulatorFactoryService', () => {
  let service: SimulatorFactoryService;
  let cs2SimulatorMock: MockProxy<Cs2SimulatorService>;
  let dota2SimulatorMock: MockProxy<Dota2SimulatorService>;

  beforeEach(async () => {
    cs2SimulatorMock = mock<Cs2SimulatorService>();
    dota2SimulatorMock = mock<Dota2SimulatorService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulatorFactoryService,
        { provide: Cs2SimulatorService, useValue: cs2SimulatorMock },
        { provide: Dota2SimulatorService, useValue: dota2SimulatorMock },
      ],
    }).compile();

    service = module.get<SimulatorFactoryService>(SimulatorFactoryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('повинен бути визначеним', () => {
    expect(service).toBeDefined();
  });

  it('повинен повертати Cs2SimulatorService для ключа "cs2"', () => {
    const simulator = service.getSimulator('cs2');
    expect(simulator).toBe(cs2SimulatorMock);
  });

  it('повинен повертати Dota2SimulatorService для ключа "dota2"', () => {
    const simulator = service.getSimulator('dota2');
    expect(simulator).toBe(dota2SimulatorMock);
  });

  it('повинен бути нечутливим до регістру (наприклад, "CS2")', () => {
    const simulator = service.getSimulator('CS2');
    expect(simulator).toBe(cs2SimulatorMock);
  });

  it('повинен викидати NotImplementedException для невідомої дисципліни', () => {
    expect(() => service.getSimulator('valorant')).toThrow(
      NotImplementedException,
    );
    expect(() => service.getSimulator('valorant')).toThrow(
      "Симулятор для дисципліни 'valorant' ще не реалізовано",
    );
  });
});
