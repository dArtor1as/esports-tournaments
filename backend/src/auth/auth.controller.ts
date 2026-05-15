import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth (Авторизація)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 30000 } })
  @ApiOperation({ summary: 'Увійти в систему (отримати JWT)' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
