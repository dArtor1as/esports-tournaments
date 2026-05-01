import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    // 1. Шукаємо юзера за email (потрібно додати метод findByEmail в UsersService!)
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Невірний email або пароль');
    }

    // 2. Порівнюємо хеші паролів
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Невірний email або пароль');
    }

    // 3. Генеруємо JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Успішний вхід',
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }
}
