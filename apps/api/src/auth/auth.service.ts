import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, toAuthUser } from '../common/types';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const profile = toAuthUser(user);
    await this.recordVisit(profile);
    return {
      token,
      user: profile,
    };
  }

  async recordVisit(user: AuthUser) {
    if (user.role !== Role.STUDENT) {
      return;
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const existing = await this.prisma.activityEvent.findFirst({
      where: { userId: user.id, createdAt: { gte: start } },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    await this.prisma.activityEvent.create({ data: { userId: user.id } });
  }
}
