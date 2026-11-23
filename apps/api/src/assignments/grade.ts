import { BadRequestException } from '@nestjs/common';
import { ExerciseType } from '@prisma/client';
import { asPackPayload, orderedTools, PACK_PASS_RATIO, type PracticeTool } from './vocab-pack';

export type GradeResult = {
  score: number;
  maxScore: number;
  review: {
    items: Array<{
      correct: boolean;
      expected?: string;
      selected?: string;
    }>;
  };
};

type McPayload = {
  items: Array<{
    prompt: string;
    options: Array<{ id: string; text: string; correct?: boolean }>;
  }>;
};

type FillPayload = {
  items: Array<{ prompt: string; answer: string }>;
};

type FlashPayload = {
  cards: Array<{ front: string; back: string }>;
};

type McAnswers = { selected: string[] };
type FillAnswers = { texts: string[] };
type FlashAnswers = { known?: boolean[]; marked?: boolean[]; texts?: string[] };

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`Некорректный формат: ${label}`);
  }
  return value as Record<string, unknown>;
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** True when shown `ru` is a real match for `ko` in the word list. */
export function yesNoPairMatches(
  item: { ko: string; ru: string },
  words: Array<{ ko: string; ru: string }>,
) {
  const word = words.find((entry) => entry.ko === item.ko);
  if (!word) return false;
  const shown = normalize(item.ru);
  if (normalize(word.ru) === shown) return true;
  return answerVariants(word.ru).some((variant) => normalize(variant) === shown);
}

export function gradeYesNoItem(
  item: { ko: string; ru: string; correct?: boolean },
  picked: boolean,
  words: Array<{ ko: string; ru: string }> = [],
) {
  const matched = words.length > 0 ? yesNoPairMatches(item, words) : Boolean(item.correct);
  return {
    correct: picked === matched,
    expected: matched ? '네' : '아니요',
  };
}

export function gradeExercise(
  type: ExerciseType,
  payload: unknown,
  answers: unknown,
): GradeResult {
  if (type === ExerciseType.MULTIPLE_CHOICE) {
    const data = asRecord(payload, 'payload') as unknown as McPayload;
    const submitted = asRecord(answers, 'answers') as unknown as McAnswers;
    const items = data.items ?? [];
    const selected = submitted.selected ?? [];
    const review = items.map((item, index) => {
      const choice = selected[index];
      const verdict = gradeMcItem(item, choice);
      return {
        correct: verdict.correct,
        expected: verdict.expected,
        selected: choice,
      };
    });
    const score = review.filter((item) => item.correct).length;
    return { score, maxScore: items.length || 1, review: { items: review } };
  }

  if (type === ExerciseType.FILL_BLANK) {
    const data = asRecord(payload, 'payload') as unknown as FillPayload;
    const submitted = asRecord(answers, 'answers') as unknown as FillAnswers;
    const items = data.items ?? [];
    const texts = submitted.texts ?? [];
    const review = items.map((item, index) => {
      const value = texts[index] ?? '';
      const verdict = gradeFillItem(item.answer, value);
      return {
        correct: verdict.correct,
        expected: verdict.expected,
        selected: value,
      };
    });
    const score = review.filter((item) => item.correct).length;
    return { score, maxScore: items.length || 1, review: { items: review } };
  }

  if (type === ExerciseType.VOCAB_PACK) {
    const pack = asPackPayload(payload);
    if (!pack) {
      throw new BadRequestException('Некорректный набор лексики');
    }
    const submitted = asRecord(answers, 'answers') as {
      tools?: Record<string, { selected?: string[]; texts?: string[]; heard?: string[]; answers?: boolean[]; known?: boolean[]; marked?: boolean[] }>
    };
    const review: GradeResult['review']['items'] = [];
    for (const tool of orderedTools(pack.tools as PracticeTool[])) {
      if (tool === 'TEST' && pack.activities.TEST) {
        const selected = submitted.tools?.TEST?.selected ?? [];
        const known = submitted.tools?.TEST?.known ?? [];
        pack.activities.TEST.items.forEach((item, index) => {
          if (known[index]) {
            review.push({ correct: true, expected: '알아요', selected: '알아요' });
            return;
          }
          const verdict = gradeMcItem(item, selected[index]);
          review.push({ correct: verdict.correct, expected: verdict.expected, selected: selected[index] });
        });
      }
      if (tool === 'WRITE' && pack.activities.WRITE) {
        const texts = submitted.tools?.WRITE?.texts ?? [];
        const known = submitted.tools?.WRITE?.known ?? [];
        pack.activities.WRITE.items.forEach((item, index) => {
          if (known[index]) {
            review.push({ correct: true, expected: '알아요', selected: '알아요' });
            return;
          }
          const verdict = gradeFillItem(item.answer, texts[index] ?? '');
          review.push({ correct: verdict.correct, expected: verdict.expected, selected: texts[index] });
        });
      }
      if (tool === 'SPEAK' && pack.activities.SPEAK) {
        const heard = submitted.tools?.SPEAK?.heard ?? [];
        const known = submitted.tools?.SPEAK?.known ?? [];
        pack.activities.SPEAK.items.forEach((item, index) => {
          if (known[index]) {
            review.push({ correct: true, expected: '알아요', selected: '알아요' });
            return;
          }
          const verdict = gradeSpoken(item.answer, heard[index] ?? '');
          review.push({ correct: verdict.correct, expected: verdict.expected, selected: heard[index] });
        });
      }
      if (tool === 'YES_NO' && pack.activities.YES_NO) {
        const answersYes = submitted.tools?.YES_NO?.answers ?? [];
        const known = submitted.tools?.YES_NO?.known ?? [];
        pack.activities.YES_NO.items.forEach((item, index) => {
          if (known[index]) {
            review.push({ correct: true, expected: '알아요', selected: '알아요' });
            return;
          }
          const picked = Boolean(answersYes[index]);
          const verdict = gradeYesNoItem(item, picked, pack.words);
          review.push({
            correct: verdict.correct,
            expected: verdict.expected,
            selected: picked ? '네' : '아니요',
          });
        });
      }
      if (tool === 'FLASHCARDS' && pack.activities.FLASHCARDS) {
        const marked = submitted.tools?.FLASHCARDS?.marked ?? [];
        const known = submitted.tools?.FLASHCARDS?.known ?? [];
        pack.activities.FLASHCARDS.cards.forEach((card, index) => {
          if (!marked[index]) {
            throw new BadRequestException('Ответьте на все карточки, прежде чем завершить');
          }
          review.push({
            correct: Boolean(known[index]),
            expected: card.back,
            selected: known[index] ? 'знаю' : 'ещё учу',
          });
        });
      }
    }
    const score = review.filter((item) => item.correct).length;
    const maxScore = review.length || 1;
    if (maxScore > 0 && score / maxScore < PACK_PASS_RATIO) {
      throw new BadRequestException(
        'Чтобы завершить тему, нужно не меньше 85% верных ответов. Повторите ошибки.',
      );
    }
    return { score, maxScore, review: { items: review } };
  }

  if (type === ExerciseType.FLASHCARDS) {
    const data = asRecord(payload, 'payload') as unknown as FlashPayload;
    const submitted = asRecord(answers, 'answers') as unknown as FlashAnswers;
    const cards = data.cards ?? [];
    const marked = submitted.marked ?? [];
    const known = submitted.known ?? [];
    if (cards.some((_, index) => !marked[index])) {
      throw new BadRequestException('Ответьте на все карточки, прежде чем завершить');
    }
    const review = cards.map((card, index) => ({
      correct: Boolean(known[index]),
      expected: card.back,
      selected: known[index] ? 'знаю' : 'ещё учу',
    }));
    const score = review.filter((item) => item.correct).length;
    return { score, maxScore: cards.length || 1, review: { items: review } };
  }

  throw new BadRequestException('Неизвестный тип упражнения');
}

export function gradeMcItem(
  item: McPayload['items'][number],
  selectedId?: string,
) {
  const correctOption = item.options.find((option) => option.correct);
  return {
    correct: Boolean(selectedId && correctOption && selectedId === correctOption.id),
    expected: correctOption?.text ?? '',
    expectedId: correctOption?.id ?? '',
  };
}

function answerVariants(answer: string) {
  const parts = answer
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [answer];
}

export function gradeFillItem(answer: string, value: string) {
  const normalized = normalize(value);
  const correct = answerVariants(answer).some((variant) => normalize(variant) === normalized);
  return {
    correct,
    expected: answer,
  };
}

export function gradeSpoken(answer: string, value: string) {
  const clean = (text: string) => text.trim().replace(/\s+/g, '').toLowerCase().normalize('NFC');
  const heard = clean(value);
  const correct =
    Boolean(value.trim()) && answerVariants(answer).some((variant) => clean(variant) === heard);
  return {
    correct,
    expected: answer,
  };
}

export function toPercent(score: number, maxScore: number) {
  if (!maxScore) {
    return 0;
  }
  return Math.round((score / maxScore) * 100);
}
