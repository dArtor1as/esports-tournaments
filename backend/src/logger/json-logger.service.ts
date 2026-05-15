import { LoggerService, Injectable } from '@nestjs/common';

@Injectable()
export class JsonLoggerService implements LoggerService {
  // NestJS передає message, а другим параметром (опціонально) - context
  log(message: unknown, context?: string) {
    if (this.shouldLog('INFO')) this.printLog('INFO', message, context);
  }
  // Метод error часто приймає stack trace помилки, тому додамо окремий параметр для нього
  error(message: unknown, trace?: string, context?: string) {
    if (this.shouldLog('ERROR'))
      this.printLog('ERROR', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    if (this.shouldLog('WARN')) this.printLog('WARN', message, context);
  }

  debug(message: unknown, context?: string) {
    if (this.shouldLog('DEBUG')) this.printLog('DEBUG', message, context);
  }

  verbose(message: unknown, context?: string) {
    if (this.shouldLog('VERBOSE')) this.printLog('VERBOSE', message, context);
  }

  // Відсікаємо спам у продакшені
  private shouldLog(level: string): boolean {
    if (process.env.NODE_ENV === 'production') {
      return !['DEBUG', 'VERBOSE'].includes(level);
    }
    return true;
  }

  private printLog(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      context: context || 'Application',
      message,
      ...(trace ? { trace } : {}),
    };

    const logString = JSON.stringify(logObject) + '\n';

    // Помилки відправляємо у stderr для правильної агрегації логів у Docker
    if (level === 'ERROR') {
      process.stderr.write(logString);
    } else {
      process.stdout.write(logString);
    }
  }
}
