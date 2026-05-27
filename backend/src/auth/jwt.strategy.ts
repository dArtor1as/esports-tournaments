import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type JwtTokenPayload = Omit<JwtPayload, 'userId'> & { sub: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('КРИТИЧНА ПОМИЛКА: JWT_SECRET відсутній в .env');
    }
    super({
      // беремо токен із заголовка Authorization: Bearer ...
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Якщо токен валідний, викликаємо цей метод
  // Те, що ми тут повертаємо, буде доступно в контролерах через req.user
  validate(payload: JwtTokenPayload) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
