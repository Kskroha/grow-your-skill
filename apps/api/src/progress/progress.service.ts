import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, Role, TopicKind } from '@prisma/client';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { computeStreak } from './streak';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async forStudent(actor: AuthUser, studentId: string) {
    if (actor.role === Role.STUDENT && actor.id !== studentId) {
      throw new ForbiddenException();
    }
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException('Ученик не найден');
    }
    if (actor.role === Role.TEACHER && student.teacherId !== actor.id) {
      throw new ForbiddenException();
    }

    const since = new Date();
    since.setDate(since.getDate() - 40);

    const [assignments, attempts, visits] = await Promise.all([
      this.prisma.assignment.findMany({
        where: { studentId },
        include: {
          exercise: {
            include: { topic: { select: { id: true, title: true, kind: true } } },
          },
        },
      }),
      this.prisma.attempt.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        include: {
          assignment: {
            include: {
              exercise: { select: { title: true, type: true } },
            },
          },
        },
      }),
      this.prisma.activityEvent.findMany({
        where: { userId: studentId, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const completed = assignments.filter(
      (assignment) => assignment.status === AssignmentStatus.COMPLETED,
    );
    const scores = completed
      .map((assignment) => assignment.bestScore)
      .filter((score): score is number => score !== null);

    const byKind = (kind: TopicKind) => {
      const subset = assignments.filter(
        (assignment) => assignment.exercise.topic.kind === kind,
      );
      const done = subset.filter(
        (assignment) => assignment.status === AssignmentStatus.COMPLETED,
      );
      const kindScores = done
        .map((assignment) => assignment.bestScore)
        .filter((score): score is number => score !== null);
      return {
        kind,
        total: subset.length,
        completed: done.length,
        averageScore:
          kindScores.length > 0
            ? Math.round(kindScores.reduce((sum, n) => sum + n, 0) / kindScores.length)
            : null,
      };
    };

    const byTopicMap = new Map<
      string,
      { topicId: string; title: string; kind: TopicKind; total: number; completed: number }
    >();
    for (const assignment of assignments) {
      const topic = assignment.exercise.topic;
      const current = byTopicMap.get(topic.id) ?? {
        topicId: topic.id,
        title: topic.title,
        kind: topic.kind,
        total: 0,
        completed: 0,
      };
      current.total += 1;
      if (assignment.status === AssignmentStatus.COMPLETED) {
        current.completed += 1;
      }
      byTopicMap.set(topic.id, current);
    }

    const lastAttemptAt = new Map<string, Date>();
    for (const attempt of attempts) {
      if (!lastAttemptAt.has(attempt.assignmentId)) {
        lastAttemptAt.set(attempt.assignmentId, attempt.createdAt);
      }
    }
    const practiced = assignments
      .filter(
        (assignment) =>
          assignment.status === AssignmentStatus.COMPLETED && lastAttemptAt.has(assignment.id),
      )
      .sort(
        (a, b) =>
          (lastAttemptAt.get(b.id)?.getTime() ?? 0) -
          (lastAttemptAt.get(a.id)?.getTime() ?? 0),
      )
      .map((assignment) => ({
        id: assignment.id,
        title: assignment.exercise.title,
        topicTitle: assignment.exercise.topic.title,
        kind: assignment.exercise.topic.kind,
        bestScore: assignment.bestScore,
      }));

    return {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        avatarUrl: student.avatarUrl,
      },
      totals: {
        total: assignments.length,
        completed: completed.length,
        averageScore:
          scores.length > 0
            ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
            : null,
        streakDays: computeStreak(attempts.map((attempt) => attempt.createdAt)),
      },
      byKind: [byKind(TopicKind.GRAMMAR), byKind(TopicKind.VOCABULARY)],
      byTopic: [...byTopicMap.values()],
      practiced,
      activity: {
        visits: visits.map((visit) => visit.createdAt),
        attempts: attempts.map((attempt) => ({
          at: attempt.createdAt,
          score: attempt.score,
        })),
      },
    };
  }
}
