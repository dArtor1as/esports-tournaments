import { Test, TestingModule } from '@nestjs/testing';
import { JsonLoggerService } from './json-logger.service';

describe('JsonLoggerService', () => {
  let service: JsonLoggerService;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JsonLoggerService],
    }).compile();

    service = module.get<JsonLoggerService>(JsonLoggerService);

    stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log levels in development', () => {
    it('INFO записує лог у stdout', () => {
      service.log('Info message', 'TestContext');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('Info message'),
      );
    });

    it('WARN записує лог у stdout', () => {
      service.warn('Warn message');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warn message'),
      );
    });

    it('DEBUG записує лог у stdout', () => {
      service.debug('Debug message');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
    });

    it('VERBOSE записує лог у stdout', () => {
      service.verbose('Verbose message');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('VERBOSE'),
      );
    });

    it('ERROR записує лог у stderr (без stack trace)', () => {
      service.error('Error message', undefined, 'TestContext');
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error message'),
      );
      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('trace'),
      );
    });

    it('ERROR записує лог у stderr (ЗІ stack trace)', () => {
      service.error('Error message', 'Stack trace string', 'TestContext');
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stack trace string'),
      );
    });
  });

  describe('production filtering', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('не логує DEBUG у production', () => {
      service.debug('This should be hidden');
      expect(stdoutSpy).toHaveBeenCalledTimes(0);
    });

    it('не логує VERBOSE у production', () => {
      service.verbose('This should be hidden');
      expect(stdoutSpy).toHaveBeenCalledTimes(0);
    });

    it('все одно логує INFO у production', () => {
      service.log('This should be visible');
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
