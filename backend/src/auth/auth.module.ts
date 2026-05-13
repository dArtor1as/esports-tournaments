import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AccessPolicyService } from './access-policy.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN');

        // Якщо в .env немає секретів — шатдаун сервера з помилкою, щоб не запускати сервер з небезпечними дефолтами
        if (!secret)
          throw new Error('КРИТИЧНА ПОМИЛКА: JWT_SECRET відсутній в .env');
        if (!expiresIn)
          throw new Error('КРИТИЧНА ПОМИЛКА: JWT_EXPIRES_IN відсутній в .env');

        return {
          secret,
          signOptions: {
            // Кастуємо до any, щоб обійти строгий внутрішній тип StringValue
            expiresIn: expiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AccessPolicyService],
  exports: [AccessPolicyService],
})
export class AuthModule {}
