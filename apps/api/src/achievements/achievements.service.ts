import { Injectable } from '@nestjs/common';
import { AssignmentStatus, TopicKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeStreak } from '../progress/streak';

const RULES: Array<{
  code: string;
  check: (ctx: {
    completed: number;
    hasPerfect: boolean;
    hasGrammar: boolean;
    hasVocab: boolean;
    streak: number;
  }) => boolean;
}> = [
  { code: 'FIRST_STEP', check: (ctx) => ctx.completed >= 1 },
  { code: 'PERFECT', check: (ctx) => ctx.hasPerfect },
  { code: 'GRAMMAR_SEAL', check: (ctx) => ctx.hasGrammar },
  { code: 'WORD_COLLECTOR', check: (ctx) => ctx.hasVocab },
  { code: 'FIVE_LESSONS', check: (ctx) => ctx.completed >= 5 },
  { code: 'STREAK_3', check: (ctx) => ctx.streak >= 3 },
];

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  listCatalog() {
    return this.prisma.achievement.findMany({ orderBy: { code: 'asc' } });
  }

  listForUser(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async evaluate(studentId: string) {
    const [assignments, attempts, owned, catalog] = await Promise.all([
      this.prisma.assignment.findMany({
        where: { studentId, status: AssignmentStatus.COMPLETED },
        include: { exercise: { include: { topic: true } } },
      }),
      this.prisma.attempt.findMany({
        where: { studentId },
        select: { createdAt: true, score: true },
      }),
      this.prisma.userAchievement.findMany({
        where: { userId: studentId },
        include: { achievement: true },
      }),
      this.prisma.achievement.findMany(),
    ]);

    const ownedCodes = new Set(owned.map((row) => row.achievement.code));
    const ctx = {
      completed: assignments.length,
      hasPerfect: attempts.some((attempt) => attempt.score >= 100),
      hasGrammar: assignments.some(
        (assignment) => assignment.exercise.topic.kind === TopicKind.GRAMMAR,
      ),
      hasVocab: assignments.some(
        (assignment) => assignment.exercise.topic.kind === TopicKind.VOCABULARY,
      ),
      streak: computeStreak(attempts.map((attempt) => attempt.createdAt)),
    };

    const unlocked = [];
    for (const rule of RULES) {
      if (ownedCodes.has(rule.code) || !rule.check(ctx)) {
        continue;
      }
      const achievement = catalog.find((item) => item.code === rule.code);
      if (!achievement) {
        continue;
      }
      const row = await this.prisma.userAchievement.create({
        data: { userId: studentId, achievementId: achievement.id },
        include: { achievement: true },
      });
      unlocked.push(row);
    }
    return unlocked;
  }
}
