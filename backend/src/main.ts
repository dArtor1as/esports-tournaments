import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { JsonLoggerService } from './logger/json-logger.service';

async function bootstrap() {
  // 1. Вмикаємо буферизацію логів, щоб Nest чекав на наш JSON логер
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Підключаємо наш кастомний логер
  const jsonLogger = app.get(JsonLoggerService);
  app.useLogger(jsonLogger);

  // обробка  (Uncaught Exceptions)
  process.on('uncaughtException', (error) => {
    jsonLogger.error(
      `Uncaught Exception: ${error.message}`,
      error.stack,
      'Process',
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    jsonLogger.error(`Unhandled Rejection, reason: ${reason}`, '', 'Process');
  });

  // 2. Плавне завершення роботи (Graceful Shutdown)
  app.enableShutdownHooks();

  // Перехоплюємо сигнал SIGTERM (і SIGINT для локальної зупинки через Ctrl+C)
  const gracefulShutdown = async (signal: string) => {
    jsonLogger.log(`${signal} received. Starting graceful shutdown...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });

  // 3. Налаштування CORS для майбутнього фронтенду
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // 4. Налаштування Swagger
  const config = new DocumentBuilder()
    .setTitle('Esports Tournament API')
    .setDescription(
      'API для дипломної роботи: Система управління кіберспортивними турнірами',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Введіть JWT токен',
      },
      'JWT-auth',
    ) //  кнопка для авторизації по токену
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Інтерфейс буде доступний за адресою /api
  SwaggerModule.setup('api', app, document);
  // 5. Додаємо глобальний пайп для валідації вхідних даних
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // 6. Запуск сервера
  await app.listen(3000);
  jsonLogger.log(`Application is running on: http://localhost:3000`);
  jsonLogger.log(`Swagger is running on: http://localhost:3000/api`);
}
bootstrap().catch((err) => {
  console.error('Помилка під час запуску:', err);
});
