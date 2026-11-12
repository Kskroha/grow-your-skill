import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, ExerciseType, Prisma, Role } from '@prisma/client';
import { stripSolutions } from '../catalog/sanitize';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckItemDto,
  CreateAssignmentsDto,
  CreatePackAssignmentDto,
  SaveProgressDto,
  SubmitAttemptDto,
} from './dto/assignment.dto';
import { itemCount, mergeCheckedItem, normalizeProgress, progressPercent } from './progress';
import {
  gradeExercise,
  gradeFillItem,
  gradeMcItem,
  gradeSpoken,
  toPercent,
} from './grade';
import {
  asPackPayload,
  buildPackPayload,
  parseTools,
  parseWords,
  packActivityCount,
  packToolSummaries,
  type PracticeTool,
} from './vocab-pack';

const assignmentInclude = {
  exercise: {
    include: { topic: { select: { id: true, title: true, kind: true } } },
  },
  student: { select: { id: true, name: true, email: true } },
  attempts: { orderBy: { createdAt: 'desc' as const }, take: 5 },
};

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teacherId: string, dto: CreateAssignmentsDto) {
    const student = await this.prisma.user.findFirst({
      where: { id: dto.studentId, teacherId, role: Role.STUDENT },
    });
    if (!student) {
      throw new NotFoundException('Ученик не найден');
    }
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: dto.exerciseIds }, authorId: teacherId },
    });
    if (exercises.length !== dto.exerciseIds.length) {
      throw new NotFoundException('Одно или несколько упражнений не найдены');
    }
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    return this.prisma.$transaction(
      dto.exerciseIds.map((exerciseId) =>
        this.prisma.assignment.create({
          data: {
            teacherId,
            studentId: dto.studentId,
            exerciseId,
            dueAt,
          },
          include: assignmentInclude,
        }),
      ),
    );
  }

  async createPack(teacherId: string, dto: CreatePackAssignmentDto) {
    const student = await this.prisma.user.findFirst({
      where: { id: dto.studentId, teacherId, role: Role.STUDENT },
    });
    if (!student) {
      throw new NotFoundException('Ученик не найден');
    }
    const topic = await this.prisma.topic.findFirst({
      where: { id: dto.topicId, authorId: teacherId },
    });
    if (!topic) {
      throw new NotFoundException('Тема не найдена');
    }
    const words = parseWords(topic.words);
    if (words.length === 0) {
      throw new BadRequestException('В теме нет слов. Добавьте лексику в материалах.');
    }
    const tools = parseTools(dto.tools);
    if (tools.length === 0) {
      throw new BadRequestException('Выберите хотя бы один инструмент');
    }
    if ((tools.includes('TEST') || tools.includes('YES_NO')) && words.length < 2) {
      throw new BadRequestException('Для теста и 네/아니요 нужно минимум два слова');
    }
    const payload = buildPackPayload(words, tools);
    const exercise = await this.prisma.exercise.create({
      data: {
        title: `Отработка: ${topic.title}`,
        prompt: tools.map((tool) => (tool === 'YES_NO' ? '네/아니요' : tool)).join(', '),
        type: ExerciseType.VOCAB_PACK,
        payload: payload as unknown as Prisma.InputJsonValue,
        topicId: topic.id,
        authorId: teacherId,
      },
    });
    return this.prisma.assignment.create({
      data: {
        teacherId,
        studentId: student.id,
        exerciseId: exercise.id,
      },
      include: assignmentInclude,
    });
  }

  async list(user: AuthUser, studentId?: string) {
    const where: Prisma.AssignmentWhereInput =
      user.role === Role.TEACHER
        ? { teacherId: user.id, ...(studentId ? { studentId } : {}) }
        : { studentId: user.id };
    const rows = await this.prisma.assignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => {
      const pack = asPackPayload(row.exercise.payload);
      const packTools = pack ? packToolSummaries(pack, row.progress) : undefined;
      const percent = progressPercent(row.exercise.type, row.exercise.payload, row.progress);
      if (user.role !== Role.STUDENT) {
        return { ...row, packTools, progressPercent: percent };
      }
      return {
        ...row,
        exercise: stripSolutions(row.exercise),
        progress: undefined,
        packTools,
        progressPercent: percent,
      };
    });
  }

  async get(user: AuthUser, id: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!assignment) {
      throw new NotFoundException('Задание не найдено');
    }
    const allowed =
      (user.role === Role.TEACHER && assignment.teacherId === user.id) ||
      (user.role === Role.STUDENT && assignment.studentId === user.id);
    if (!allowed) {
      throw new ForbiddenException();
    }
    if (user.role === Role.STUDENT && assignment.status === AssignmentStatus.ASSIGNED) {
      await this.prisma.assignment.update({
        where: { id },
        data: { status: AssignmentStatus.IN_PROGRESS },
      });
      assignment.status = AssignmentStatus.IN_PROGRESS;
    }
    if (user.role === Role.STUDENT) {
      const resume =
        assignment.status === AssignmentStatus.COMPLETED ? null : assignment.progress;
      const pack = asPackPayload(assignment.exercise.payload);
      return {
        ...assignment,
        progress: resume,
        progressPercent: progressPercent(
          assignment.exercise.type,
          assignment.exercise.payload,
          resume,
        ),
        packTools: pack ? packToolSummaries(pack, resume) : undefined,
        exercise: stripSolutions(assignment.exercise),
      };
    }
    return assignment;
  }

  async remove(teacherId: string, id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, teacherId },
    });
    if (!assignment) {
      throw new NotFoundException('Задание не найдено');
    }
    await this.prisma.assignment.delete({ where: { id } });
    return { ok: true };
  }

  async checkItem(user: AuthUser, id: string, dto: CheckItemDto) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException();
    }
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, studentId: user.id },
      include: { exercise: true },
    });
    if (!assignment) {
      throw new NotFoundException('Задание не найдено');
    }
    if (assignment.exercise.type === ExerciseType.VOCAB_PACK) {
      return this.checkPackItem(assignment, dto);
    }
    if (assignment.exercise.type === ExerciseType.FLASHCARDS) {
      throw new BadRequestException('Карточки отмечаются без проверки перевода');
    }
    const payload = assignment.exercise.payload as {
      items?: Array<{
        prompt: string;
        answer?: string;
        options?: Array<{ id: string; text: string; correct?: boolean }>;
      }>;
    };
    const item = payload.items?.[dto.index];
    if (!item) {
      throw new NotFoundException('Вопрос не найден');
    }
    if (assignment.exercise.type === 'MULTIPLE_CHOICE') {
      const result = gradeMcItem(
        {
          prompt: item.prompt,
          options: item.options ?? [],
        },
        dto.selected,
      );
      await this.persistChecked(assignment, dto, result);
      return result;
    }
    if (assignment.exercise.type === 'FILL_BLANK') {
      const result = gradeFillItem(item.answer ?? '', dto.text ?? '');
      await this.persistChecked(assignment, dto, result);
      return result;
    }
    throw new BadRequestException('Этот тип проверяется иначе');
  }

  async submit(user: AuthUser, id: string, dto: SubmitAttemptDto) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Только ученик может сдавать упражнение');
    }
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, studentId: user.id },
      include: { exercise: { include: { topic: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Задание не найдено');
    }
    const graded = gradeExercise(
      assignment.exercise.type,
      assignment.exercise.payload,
      dto.answers,
    );
    const percent = toPercent(graded.score, graded.maxScore);
    const attempt = await this.prisma.attempt.create({
      data: {
        assignmentId: assignment.id,
        studentId: user.id,
        answers: dto.answers as Prisma.InputJsonValue,
        score: percent,
        maxScore: 100,
        review: graded.review as Prisma.InputJsonValue,
      },
    });
    const bestScore = Math.max(assignment.bestScore ?? 0, percent);
    await this.prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        status: AssignmentStatus.COMPLETED,
        bestScore,
        completedAt: assignment.completedAt ?? new Date(),
        progress: Prisma.DbNull,
      },
    });
    return {
      attempt,
      percent,
      review: graded.review,
    };
  }

  async restart(user: AuthUser, id: string) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException();
    }
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, studentId: user.id },
    });
    if (!assignment) {
      throw new NotFoundException('Задание не найдено');
    }
    return this.prisma.assignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.ASSIGNED,
        bestScore: null,
        completedAt: null,
        progress: Prisma.DbNull,
      },
      include: assignmentInclude,
    });
  }

  async saveProgress(user: AuthUser, id: string, dto: SaveProgressDto) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException();
    }
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, studentId: user.id },
      include: { exercise: true },
    });
    if (!assignment) {
      throw new NotFoundException('Задание не найдено');
    }
    if (assignment.status === AssignmentStatus.COMPLETED) {
      return { ok: true };
    }
    if (assignment.exercise.type === ExerciseType.VOCAB_PACK) {
      await this.prisma.assignment.update({
        where: { id },
        data: {
          status: AssignmentStatus.IN_PROGRESS,
          progress: dto.progress as Prisma.InputJsonValue,
        },
      });
      return {
        ok: true,
        progressPercent: progressPercent(
          assignment.exercise.type,
          assignment.exercise.payload,
          dto.progress as unknown as Prisma.JsonValue,
        ),
      };
    }
    const count = itemCount(assignment.exercise.type, assignment.exercise.payload);
    const progress = normalizeProgress(dto.progress as Prisma.InputJsonValue, count);
    await this.prisma.assignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.IN_PROGRESS,
        progress: progress as Prisma.InputJsonValue,
      },
    });
    return { ok: true, progressPercent: progressPercent(assignment.exercise.type, assignment.exercise.payload, progress) };
  }

  private async persistChecked(
    assignment: {
      id: string;
      status: AssignmentStatus;
      progress: Prisma.JsonValue | null;
      exercise: { type: ExerciseType; payload: Prisma.JsonValue };
    },
    dto: CheckItemDto,
    feedback: { correct: boolean; expected: string; expectedId?: string },
  ) {
    if (assignment.status === AssignmentStatus.COMPLETED) {
      return;
    }
    const count = itemCount(assignment.exercise.type, assignment.exercise.payload);
    const progress = mergeCheckedItem(assignment.progress, count, dto.index, {
      selected: dto.selected,
      text: dto.text,
      feedback,
    });
    await this.prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        status: AssignmentStatus.IN_PROGRESS,
        progress: progress as Prisma.InputJsonValue,
      },
    });
  }

  private async checkPackItem(
    assignment: {
      id: string;
      status: AssignmentStatus;
      studentId: string;
      progress: Prisma.JsonValue | null;
      exercise: { type: ExerciseType; payload: Prisma.JsonValue };
    },
    dto: CheckItemDto,
  ) {
    const pack = asPackPayload(assignment.exercise.payload);
    if (!pack || !dto.tool) {
      throw new BadRequestException('Некорректное задание набора');
    }
    const tool = dto.tool as PracticeTool;
    let result: { correct: boolean; expected: string; expectedId?: string };
    if (tool === 'TEST' && pack.activities.TEST) {
      const item = pack.activities.TEST.items[dto.index];
      if (!item) throw new NotFoundException('Вопрос не найден');
      result = gradeMcItem(item, dto.selected);
    } else if (tool === 'WRITE' && pack.activities.WRITE) {
      const item = pack.activities.WRITE.items[dto.index];
      if (!item) throw new NotFoundException('Вопрос не найден');
      result = gradeFillItem(item.answer, dto.text ?? '');
    } else if (tool === 'SPEAK' && pack.activities.SPEAK) {
      const item = pack.activities.SPEAK.items[dto.index];
      if (!item) throw new NotFoundException('Вопрос не найден');
      result = gradeSpoken(item.answer, dto.heard ?? '');
    } else if (tool === 'YES_NO' && pack.activities.YES_NO) {
      const item = pack.activities.YES_NO.items[dto.index];
      if (!item) throw new NotFoundException('Вопрос не найден');
      const picked = Boolean(dto.yes);
      result = {
        correct: picked === item.correct,
        expected: item.correct ? '네' : '아니요',
      };
    } else {
      throw new BadRequestException('Этот шаг проверяется иначе');
    }
    if (assignment.status !== AssignmentStatus.COMPLETED) {
      const current =
        assignment.progress && typeof assignment.progress === 'object' && !Array.isArray(assignment.progress)
          ? { ...(assignment.progress as Record<string, unknown>) }
          : {};
      const tools = {
        ...((current.tools as Record<string, Record<string, unknown>>) ?? {}),
      };
      const count = packActivityCount(pack, tool);
      const slot = { ...(tools[tool] ?? {}) };
      const feedback = Array.from({ length: count }, (_, index) =>
        Array.isArray(slot.feedback) ? (slot.feedback[index] ?? null) : null,
      );
      feedback[dto.index] = result;
      tools[tool] = {
        ...slot,
        step: dto.index,
        feedback,
        done: feedback.every(Boolean),
      };
      await this.prisma.assignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.IN_PROGRESS,
          progress: { ...current, tools } as Prisma.InputJsonValue,
        },
      });
    }
    return result;
  }
}
