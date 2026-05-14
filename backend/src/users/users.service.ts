import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { AccessPolicyService } from 'src/auth/access-policy.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private accessPolicy: AccessPolicyService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    // 1. Перевіряємо email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingEmail)
      throw new ConflictException('Email вже використовується');

    // 2. Перевіряємо username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });
    if (existingUsername) throw new ConflictException('Цей логін вже зайнятий');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        username: createUserDto.username,
        email: createUserDto.email,
        passwordHash: hashedPassword,
        role: createUserDto.role || 'USER',
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return newUser;
  }
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        countryCode: true,
        // Можна додати короткий список профілів
        players: {
          select: { id: true, gameId: true, nickname: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }
  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto, user: JwtPayload) {
    // 1. Шукаємо користувача
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('Користувача не знайдено');

    // 2. перевіряємо, чи це сам користувач або він Адмін?
    this.accessPolicy.checkSelfOrAdmin(targetUser.id, user);

    // 3. Якщо перевірка пройдена - оновлюємо
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: string, user: JwtPayload) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundException('Користувача не знайдено');

    this.accessPolicy.checkSelfOrAdmin(targetUser.id, user);

    return this.prisma.user.delete({ where: { id } });
  }
}
