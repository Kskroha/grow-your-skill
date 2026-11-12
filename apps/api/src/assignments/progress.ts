import { ExerciseType, Prisma } from '@prisma/client';
import { asPackPayload, packProgressPercent, packTotalCount } from './vocab-pack';

export type ItemFeedback = {
  correct: boolean;
  expected: string;
  expectedId?: string;
};

export type StoredProgress = {
  step?: number;
  selected?: string[];
  texts?: string[];
  known?: boolean[];
  marked?: boolean[];
  feedback?: Array<ItemFeedback | null>;
};

function asProgress(value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined): StoredProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as StoredProgress;
}

export function itemCount(
  type: ExerciseType,
  payload: Prisma.JsonValue,
): number {
  if (type === ExerciseType.VOCAB_PACK) {
    const pack = asPackPayload(payload);
    return pack ? packTotalCount(pack) : 0;
  }
  const data = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as { items?: unknown[]; cards?: unknown[] })
    : {};
  if (type === ExerciseType.FLASHCARDS) {
    return data.cards?.length ?? 0;
  }
  return data.items?.length ?? 0;
}

export function progressPercent(
  type: ExerciseType,
  payload: Prisma.JsonValue,
  progress: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
): number {
  if (type === ExerciseType.VOCAB_PACK) {
    const pack = asPackPayload(payload);
    return pack ? packProgressPercent(pack, progress) : 0;
  }
  const total = itemCount(type, payload);
  if (!total) return 0;
  const saved = asProgress(progress);
  const done = (saved.feedback ?? saved.marked ?? []).filter(Boolean).length;
  return Math.round((Math.min(done, total) / total) * 100);
}

export function mergeCheckedItem(
  progress: Prisma.JsonValue | null | undefined,
  count: number,
  index: number,
  patch: { selected?: string; text?: string; feedback: ItemFeedback },
): StoredProgress {
  const next = normalizeProgress(progress, count);
  next.step = index;
  next.feedback[index] = patch.feedback;
  if (patch.selected != null) {
    next.selected[index] = patch.selected;
  }
  if (patch.text != null) {
    next.texts[index] = patch.text;
  }
  return next;
}

export function normalizeProgress(
  progress: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  count: number,
): Required<StoredProgress> {
  const saved = asProgress(progress);
  return {
    step: Math.min(Math.max(saved.step ?? 0, 0), Math.max(count - 1, 0)),
    selected: pad(saved.selected, count, ''),
    texts: pad(saved.texts, count, ''),
    known: pad(saved.known, count, false),
    marked: pad(saved.marked, count, false),
    feedback: pad(saved.feedback, count, null),
  };
}

function pad<T>(value: T[] | undefined, count: number, fill: T): T[] {
  const next = Array.from({ length: count }, () => fill);
  (value ?? []).slice(0, count).forEach((item, index) => {
    next[index] = item;
  });
  return next;
}
