import { Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, ExerciseType, Prisma } from '@prisma/client';
import {
  asPackPayload,
  buildPackPayload,
  parseTools,
  parseWords,
  sameWordKeys,
} from '../assignments/vocab-pack';
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
    const previous = await this.getTopic(authorId, id);
    const { words, ...rest } = dto;
    const normalizedWords = words
      ? words.map((word) => ({
          ko: word.ko,
          ru: word.ru,
          ...(word.roman ? { roman: word.roman } : {}),
        }))
      : null;
    const topic = await this.prisma.topic.update({
      where: { id },
      data: {
        ...rest,
        ...(normalizedWords
          ? { words: normalizedWords as Prisma.InputJsonValue }
          : {}),
      },
    });

    if (normalizedWords) {
      await this.syncVocabPackExercises(
        authorId,
        id,
        topic.title,
        parseWords(previous.words),
        parseWords(normalizedWords),
      );
    }

    return topic;
  }

  private async syncVocabPackExercises(
    authorId: string,
    topicId: string,
    topicTitle: string,
    previousWords: ReturnType<typeof parseWords>,
    nextWords: ReturnType<typeof parseWords>,
  ) {
    const packs = await this.prisma.exercise.findMany({
      where: { topicId, authorId, type: ExerciseType.VOCAB_PACK },
    });
    if (packs.length === 0) return;

    const keysChanged = !sameWordKeys(previousWords, nextWords);
    for (const exercise of packs) {
      const tools = parseTools(asPackPayload(exercise.payload)?.tools);
      if (tools.length === 0) continue;
      await this.prisma.exercise.update({
        where: { id: exercise.id },
        data: {
          title: `Отработка: ${topicTitle}`,
          payload: buildPackPayload(
            nextWords,
            tools,
          ) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    if (!keysChanged) return;

    await this.prisma.assignment.updateMany({
      where: {
        exerciseId: { in: packs.map((item) => item.id) },
        status: { in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS] },
      },
      data: {
        progress: Prisma.DbNull,
        status: AssignmentStatus.ASSIGNED,
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
