import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/exercise.dto';
import { CreateTopicDto, UpdateTopicDto } from './dto/topic.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listTopics(authorId: string) {
    return this.prisma.topic.findMany({
      where: { authorId },
      include: { _count: { select: { exercises: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getTopic(authorId: string, id: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id, authorId },
      include: { exercises: { orderBy: { createdAt: 'asc' } } },
    });
    if (!topic) {
      throw new NotFoundException('Тема не найдена');
    }
    return topic;
  }

  createTopic(authorId: string, dto: CreateTopicDto) {
    return this.prisma.topic.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        kind: dto.kind,
        authorId,
      },
    });
  }

  async updateTopic(authorId: string, id: string, dto: UpdateTopicDto) {
    await this.getTopic(authorId, id);
    const { words, ...rest } = dto;
    return this.prisma.topic.update({
      where: { id },
      data: {
        ...rest,
        ...(words
          ? {
              words: words.map((word) => ({
                ko: word.ko,
                ru: word.ru,
                ...(word.roman ? { roman: word.roman } : {}),
              })) as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
  }

  async deleteTopic(authorId: string, id: string) {
    await this.getTopic(authorId, id);
    await this.prisma.topic.delete({ where: { id } });
    return { ok: true };
  }

  listExercises(authorId: string, topicId?: string) {
    return this.prisma.exercise.findMany({
      where: { authorId, ...(topicId ? { topicId } : {}) },
      include: { topic: { select: { id: true, title: true, kind: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getExercise(authorId: string, id: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id, authorId },
      include: { topic: { select: { id: true, title: true, kind: true } } },
    });
    if (!exercise) {
      throw new NotFoundException('Упражнение не найдено');
    }
    return exercise;
  }

  async createExercise(authorId: string, dto: CreateExerciseDto) {
    await this.getTopic(authorId, dto.topicId);
    return this.prisma.exercise.create({
      data: {
        title: dto.title,
        prompt: dto.prompt ?? '',
        type: dto.type,
        payload: dto.payload as Prisma.InputJsonValue,
        topicId: dto.topicId,
        authorId,
      },
      include: { topic: { select: { id: true, title: true, kind: true } } },
    });
  }

  async updateExercise(authorId: string, id: string, dto: UpdateExerciseDto) {
    await this.getExercise(authorId, id);
    if (dto.topicId) {
      await this.getTopic(authorId, dto.topicId);
    }
    return this.prisma.exercise.update({
      where: { id },
      data: {
        ...dto,
        payload: dto.payload as Prisma.InputJsonValue | undefined,
      },
      include: { topic: { select: { id: true, title: true, kind: true } } },
    });
  }

  async deleteExercise(authorId: string, id: string) {
    await this.getExercise(authorId, id);
    await this.prisma.exercise.delete({ where: { id } });
    return { ok: true };
  }
}
