import { Exercise, ExerciseType, Prisma } from '@prisma/client';
import { asPackPayload, stripPackSolutions } from '../assignments/vocab-pack';

type McOption = { id: string; text: string; correct?: boolean };
type McItem = { prompt: string; options: McOption[] };
type FillItem = { prompt: string; answer?: string; hint?: string };

export function stripSolutions(exercise: Exercise): Exercise {
  const payload = exercise.payload as Prisma.JsonObject;
  if (exercise.type === ExerciseType.MULTIPLE_CHOICE) {
    const items = (payload.items as McItem[] | undefined)?.map((item) => ({
      prompt: item.prompt,
      options: item.options.map((option) => ({
        id: option.id,
        text: option.text,
      })),
    }));
    return { ...exercise, payload: { items } };
  }
  if (exercise.type === ExerciseType.VOCAB_PACK) {
    const pack = asPackPayload(exercise.payload);
    return { ...exercise, payload: pack ? stripPackSolutions(pack) : exercise.payload };
  }
  if (exercise.type === ExerciseType.FILL_BLANK) {
    const items = (payload.items as FillItem[] | undefined)?.map((item) => ({
      prompt: item.prompt,
      hint: item.hint,
    }));
    return { ...exercise, payload: { items } };
  }
  return exercise;
}
