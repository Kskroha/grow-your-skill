import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AVATARS_DIR, ensureUploadDirs } from '../uploads';
import { toAuthUser } from '../common/types';
import { CreateStudentDto } from './dto/create-student.dto';

function generatePassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createStudent(teacherId: string, dto: CreateStudentDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ученик с таким email уже есть');
    }
    const password = dto.password ?? generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const student = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        role: Role.STUDENT,
        passwordHash,
        teacherId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    return { student, password };
  }

  async listStudents(teacherId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 40);
    const students = await this.prisma.user.findMany({
      where: { teacherId, role: Role.STUDENT },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        visits: {
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        },
        assignedToMe: {
          select: {
            status: true,
            bestScore: true,
            completedAt: true,
            attempts: {
              where: { createdAt: { gte: since } },
              select: { createdAt: true, score: true },
            },
          },
        },
      },
    });

    return students.map((student) => {
      const total = student.assignedToMe.length;
      const completed = student.assignedToMe.filter(
        (a) => a.status === 'COMPLETED',
      );
      const scores = completed
        .map((a) => a.bestScore)
        .filter((s): s is number => s !== null);
      const attemptRows = student.assignedToMe.flatMap((assignment) => assignment.attempts);
      const lastActiveAt =
        [...attemptRows.map((row) => row.createdAt), ...student.visits.map((row) => row.createdAt)].sort(
          (a, b) => b.getTime() - a.getTime(),
        )[0] ?? null;
      return {
        id: student.id,
        email: student.email,
        name: student.name,
        avatarUrl: student.avatarUrl,
        createdAt: student.createdAt,
        progress: {
          total,
          completed: completed.length,
          averageScore:
            scores.length > 0
              ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
              : null,
          lastActiveAt,
        },
        activity: {
          visits: student.visits.map((row) => row.createdAt),
          attempts: attemptRows.map((row) => ({ at: row.createdAt, score: row.score })),
        },
      };
    });
  }

  async getStudent(teacherId: string, studentId: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, teacherId, role: Role.STUDENT },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    if (!student) {
      throw new NotFoundException('Ученик не найден');
    }
    return student;
  }

  async setAvatar(
    userId: string,
    file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Выберите фото');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Нужно изображение');
    }
    if (file.size > 400_000) {
      throw new BadRequestException('Фото всё ещё слишком тяжёлое');
    }
    if (file.buffer[0] !== 0xff || file.buffer[1] !== 0xd8) {
      throw new BadRequestException('Сохраните фото в JPEG');
    }

    ensureUploadDirs();
    const filename = `${userId}.jpg`; // one file per student, overwritten on change
    writeFileSync(join(AVATARS_DIR, filename), file.buffer);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: `/uploads/avatars/${filename}?v=${Date.now()}` },
    });
    return toAuthUser(user);
  }
}

