import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Налаштування CORS для майбутнього фронтенду
  app.enableCors({
    origin: 'http://localhost:5173', // Порт Vite за замовчуванням
    credentials: true,
  });

  // 2. Налаштування Swagger
  const config = new DocumentBuilder()
    .setTitle('Esports Tournament API')
    .setDescription(
      'API для дипломної роботи: Система управління кіберспортивними турнірами',
    )
    .setVersion('1.0')
    .addBearerAuth() // Додаємо кнопку для авторизації по токену
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Інтерфейс буде доступний за адресою /api
  SwaggerModule.setup('api', app, document);
  // 3. Додаємо глобальний пайп для валідації вхідних даних
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // 4. Запуск сервера
  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
  console.log(`Swagger is running on: http://localhost:3000/api`);
}
bootstrap();
