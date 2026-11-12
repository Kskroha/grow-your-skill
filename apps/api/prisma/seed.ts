import { ExerciseType, PrismaClient, Role, TopicKind } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const teacherHash = await bcrypt.hash('teacher123', 10);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@grow.local' },
    update: { name: 'Ксения', passwordHash: teacherHash, role: Role.TEACHER },
    create: {
      id: 'user_teacher',
      email: 'teacher@grow.local',
      name: 'Ксения',
      role: Role.TEACHER,
      passwordHash: teacherHash,
    },
  });

  const achievements = [
    {
      code: 'FIRST_STEP',
      title: 'Первый шаг',
      description: 'Закрыть первое назначенное упражнение',
    },
    {
      code: 'PERFECT',
      title: 'Чистый лист',
      description: 'Набрать 100% в любом упражнении',
    },
    {
      code: 'GRAMMAR_SEAL',
      title: 'Печать грамматики',
      description: 'Завершить упражнение по грамматике',
    },
    {
      code: 'WORD_COLLECTOR',
      title: 'Собиратель слов',
      description: 'Завершить упражнение по лексике',
    },
    {
      code: 'FIVE_LESSONS',
      title: 'Пять тетрадей',
      description: 'Закрыть пять заданий',
    },
    {
      code: 'STREAK_3',
      title: 'Три дня подряд',
      description: 'Заниматься три дня подряд',
    },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: { title: achievement.title, description: achievement.description },
      create: achievement,
    });
  }

  const particles = await prisma.topic.upsert({
    where: { id: 'topic_particles' },
    update: {},
    create: {
      id: 'topic_particles',
      title: 'Частицы 은/는 и 이/가',
      description: 'Тема и подлежащее: когда выделяем, а когда просто называем.',
      kind: TopicKind.GRAMMAR,
      authorId: teacher.id,
    },
  });

  const foodWords = [
    { ko: '밥', ru: 'рис', roman: 'bap' },
    { ko: '김치', ru: 'кимчи', roman: 'gimchi' },
    { ko: '사과', ru: 'яблоко', roman: 'sagwa' },
    { ko: '물', ru: 'вода', roman: 'mul' },
    { ko: '빵', ru: 'хлеб', roman: 'ppang' },
    { ko: '커피', ru: 'кофе', roman: 'keopi' },
    { ko: '라면', ru: 'рамен', roman: 'ramyeon' },
    { ko: '과일', ru: 'фрукты', roman: 'gwail' },
    { ko: '국', ru: 'суп', roman: 'guk' },
    { ko: '고기', ru: 'мясо', roman: 'gogi' },
  ];

  const food = await prisma.topic.upsert({
    where: { id: 'topic_food' },
    update: { words: foodWords },
    create: {
      id: 'topic_food',
      title: 'Слова: еда',
      description: 'Базовый список продуктов и блюд для повседневных диалогов.',
      kind: TopicKind.VOCABULARY,
      authorId: teacher.id,
      words: foodWords,
    },
  });

  await prisma.exercise.upsert({
    where: { id: 'ex_particles_mc' },
    update: {},
    create: {
      id: 'ex_particles_mc',
      title: 'Выберите частицу',
      prompt: 'Вставьте подходящую частицу.',
      type: ExerciseType.MULTIPLE_CHOICE,
      topicId: particles.id,
      authorId: teacher.id,
      payload: {
        items: [
          {
            prompt: '저___ 학생입니다. (Я — студент.)',
            options: [
              { id: 'a', text: '는', correct: true },
              { id: 'b', text: '를', correct: false },
              { id: 'c', text: '에', correct: false },
              { id: 'd', text: '와', correct: false },
            ],
          },
          {
            prompt: '학교___ 가요. (Иду в школу.)',
            options: [
              { id: 'a', text: '은', correct: false },
              { id: 'b', text: '에', correct: true },
              { id: 'c', text: '를', correct: false },
              { id: 'd', text: '이', correct: false },
            ],
          },
          {
            prompt: '사과___ 먹어요. (Ем яблоко.)',
            options: [
              { id: 'a', text: '가', correct: false },
              { id: 'b', text: '는', correct: false },
              { id: 'c', text: '를', correct: true },
              { id: 'd', text: '에서', correct: false },
            ],
          },
          {
            prompt: '날씨___ 좋아요. (Погода хорошая.)',
            options: [
              { id: 'a', text: '를', correct: false },
              { id: 'b', text: '가', correct: true },
              { id: 'c', text: '에', correct: false },
              { id: 'd', text: '와', correct: false },
            ],
          },
        ],
      },
    },
  });

  await prisma.exercise.upsert({
    where: { id: 'ex_particles_fill' },
    update: {},
    create: {
      id: 'ex_particles_fill',
      title: 'Вставьте частицу',
      prompt: 'Напишите частицу в пропуске. Ответ — только частица.',
      type: ExerciseType.FILL_BLANK,
      topicId: particles.id,
      authorId: teacher.id,
      payload: {
        items: [
          { prompt: '오늘___ 비가 와요.', answer: '은', hint: 'тема дня' },
          { prompt: '고양이___ 귀여워요.', answer: '가', hint: 'подлежащее' },
          { prompt: '커피___ 마셔요.', answer: '를', hint: 'дополнение' },
        ],
      },
    },
  });

  await prisma.exercise.upsert({
    where: { id: 'ex_food_cards' },
    update: {},
    create: {
      id: 'ex_food_cards',
      title: 'Карточки: еда',
      prompt: 'Переверните карточку и отметьте, знаете ли слово.',
      type: ExerciseType.FLASHCARDS,
      topicId: food.id,
      authorId: teacher.id,
      payload: {
        cards: [
          { front: '밥', back: 'рис, еда', hint: 'bap' },
          { front: '김치', back: 'кимчи', hint: 'gimchi' },
          { front: '사과', back: 'яблоко', hint: 'sagwa' },
          { front: '물', back: 'вода', hint: 'mul' },
          { front: '빵', back: 'хлеб', hint: 'ppang' },
          { front: '커피', back: 'кофе', hint: 'keopi' },
          { front: '라면', back: 'рамен', hint: 'ramyeon' },
          { front: '과일', back: 'фрукты', hint: 'gwail' },
        ],
      },
    },
  });

  await prisma.exercise.upsert({
    where: { id: 'ex_food_mc' },
    update: {},
    create: {
      id: 'ex_food_mc',
      title: 'Что это значит?',
      prompt: 'Выберите перевод слова.',
      type: ExerciseType.MULTIPLE_CHOICE,
      topicId: food.id,
      authorId: teacher.id,
      payload: {
        items: [
          {
            prompt: '김치',
            options: [
              { id: 'a', text: 'суп', correct: false },
              { id: 'b', text: 'кимчи', correct: true },
              { id: 'c', text: 'рис', correct: false },
            ],
          },
          {
            prompt: '물',
            options: [
              { id: 'a', text: 'вода', correct: true },
              { id: 'b', text: 'молоко', correct: false },
              { id: 'c', text: 'чай', correct: false },
            ],
          },
          {
            prompt: '빵',
            options: [
              { id: 'a', text: 'рыба', correct: false },
              { id: 'b', text: 'мясо', correct: false },
              { id: 'c', text: 'хлеб', correct: true },
            ],
          },
        ],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
