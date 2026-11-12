import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ExerciseType, PrismaClient, Role, TopicKind } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

for (const path of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
]) {
  loadEnvFile(path);
}

const prisma = new PrismaClient();

async function main() {
  const email = process.env.TEACHER_EMAIL?.trim();
  const password = process.env.TEACHER_PASSWORD;
  if (!email || !password) {
    throw new Error('Задайте TEACHER_EMAIL и TEACHER_PASSWORD в .env');
  }
  const teacherHash = await bcrypt.hash(password, 10);

  const teacher = await prisma.user.upsert({
    where: { id: 'user_teacher' },
    update: { email, name: 'Ксения', passwordHash: teacherHash, role: Role.TEACHER },
    create: {
      id: 'user_teacher',
      email,
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

  const euIrregularWords = [
    { ko: '크다', ru: 'большой', roman: 'keuda' },
    { ko: '쓰다', ru: 'писать', roman: 'sseuda' },
    { ko: '아프다', ru: 'болит', roman: 'apeuda' },
    { ko: '바쁘다', ru: 'занят', roman: 'bappeuda' },
    { ko: '나쁘다', ru: 'плохой', roman: 'nappeuda' },
    { ko: '예쁘다', ru: 'красивая', roman: 'yeppeuda' },
    { ko: '배고프다', ru: 'голодный', roman: 'baegopeuda' },
  ];

  const foodDeliveryWords = [
    { ko: '주문하다', ru: 'заказывать', roman: 'jumunhada' },
    { ko: '포장하다', ru: 'упаковывать', roman: 'pojanghada' },
    { ko: '배달하다', ru: 'доставлять', roman: 'baedalhada' },
    { ko: '시키다', ru: 'заказывать (еду)', roman: 'sikida' },
    { ko: '판', ru: 'пицца (счётн. сл.)', roman: 'pan' },
    { ko: '조각', ru: 'кусок', roman: 'jogak' },
    { ko: '마리', ru: 'счётн. сл. для животных', roman: 'mari' },
    { ko: '그릇', ru: 'миска', roman: 'geureut' },
    { ko: '줄', ru: 'ряд, связка', roman: 'jul' },
    { ko: '인분', ru: 'порция', roman: 'inbun' },
    { ko: '맛', ru: 'вкус', roman: 'mat' },
    { ko: '달다', ru: 'сладкий', roman: 'dalda' },
    { ko: '짜다', ru: 'солёный', roman: 'jjada' },
    { ko: '시다', ru: 'кислый', roman: 'sida' },
    { ko: '분위기', ru: 'атмосфера', roman: 'bunwigi' },
    { ko: '갖다 주다', ru: 'принести, подать', roman: 'gatda juda' },
    { ko: '돈이 아깝다', ru: 'денег жалко', roman: 'doni akkapda' },
    { ko: '동갑', ru: 'сверстник', roman: 'donggap' },
    { ko: '반말', ru: 'речь на «ты»', roman: 'banmal' },
    { ko: '입에 맞다', ru: 'быть по вкусу', roman: 'ibe matda' },
    { ko: '말을 놓다', ru: 'перейти «на ты»', roman: 'mareul notda' },
    { ko: '커피가 너무 써요', ru: 'кофе слишком горький', roman: 'keopiga neomu sseoyo' },
    { ko: '짠 음식을 안 먹어요', ru: 'не ем солёную еду', roman: 'jjan eumsigeul an meogeoyo' },
    { ko: '치킨이 조금 달아요', ru: 'курица немного сладкая', roman: 'chikini jogeum darayo' },
    { ko: '말을 놓을까요?', ru: 'перейдём на «ты»?', roman: 'mareul noeulkkayo' },
  ];

  await prisma.topic.upsert({
    where: { id: 'topic_food_delivery' },
    update: {
      title: 'Еда, доставка',
      description: 'Заказ, упаковка, доставка, счётные слова и выражения про вкус.',
      words: foodDeliveryWords,
    },
    create: {
      id: 'topic_food_delivery',
      title: 'Еда, доставка',
      description: 'Заказ, упаковка, доставка, счётные слова и выражения про вкус.',
      kind: TopicKind.VOCABULARY,
      authorId: teacher.id,
      words: foodDeliveryWords,
    },
  });

  const illnessL2Words = [
    { ko: '속이 안 좋다', ru: 'плохо в животе', roman: 'sogi an jota' },
    { ko: '몸살이 나다', ru: 'ломота в теле', roman: 'momsari nada' },
    { ko: '다리를 다치다', ru: 'повредить ногу', roman: 'darireul dachida' },
    { ko: '소화가 안되다', ru: 'несварение', roman: 'sohwaga andoeda' },
    { ko: '배탈이 나다', ru: 'расстройство желудка', roman: 'baetari nada' },
    { ko: '토하다', ru: 'рвать', roman: 'tohada' },
    { ko: '어지럽다', ru: 'кружится голова', roman: 'eojireopda' },
    { ko: '멀미를 하다', ru: 'укачивает', roman: 'meolmireul hada' },
    { ko: '얼굴에 뭐가 나다', ru: 'высыпания на лице', roman: 'eolgure mwoga nada' },
    { ko: '입맛이 없다', ru: 'нет аппетита', roman: 'immasi eopda' },
    { ko: '기운이 없다', ru: 'нет сил', roman: 'giuni eopda' },
    { ko: '잠을 잘 못 자다', ru: 'плохо спать', roman: 'jameul jal mot jada' },
    { ko: '내과', ru: 'терапия', roman: 'naegwa' },
    { ko: '안과', ru: 'глазное отделение', roman: 'angwa' },
    { ko: '치과', ru: 'стоматология', roman: 'chigwa' },
    { ko: '피부과', ru: 'дерматология', roman: 'pibugwa' },
    { ko: '정형외과', ru: 'ортопедия', roman: 'jeonghyeong-oegwa' },
    { ko: '이비인후과', ru: 'ЛОР', roman: 'ibiinhugwa' },
    { ko: '감기약', ru: 'лекарство от простуды', roman: 'gamgiyak' },
    { ko: '두통약', ru: 'таблетка от головы', roman: 'dutongyak' },
    { ko: '멀미약', ru: 'лекарство от укачивания', roman: 'meolmiyak' },
    { ko: '소화제', ru: 'средство для пищеварения', roman: 'sohwaje' },
    { ko: '해열제', ru: 'жаропонижающее', roman: 'haeyeolje' },
    { ko: '안약', ru: 'глазные капли', roman: 'anyak' },
    { ko: '파스', ru: 'болеутоляющий пластырь', roman: 'paseu' },
    { ko: '연고', ru: 'мазь', roman: 'yeongo' },
    { ko: '(약을) 먹다', ru: 'принимать (лекарство)', roman: 'yageul meokda' },
    { ko: '(안약을) 넣다', ru: 'закапывать (капли)', roman: 'anyageul neota' },
    { ko: '(파스를) 붙이다', ru: 'клеить (пластырь)', roman: 'paseureul butida' },
    { ko: '(연고를) 바르다', ru: 'мазать (мазь)', roman: 'yeongoreul bareuda' },
  ];

  await prisma.topic.upsert({
    where: { id: 'topic_illness_l2' },
    update: {
      title: 'Болезни, уровень 2',
      description: 'Самочувствие, отделения больницы, лекарства и как их принимать.',
      words: illnessL2Words,
    },
    create: {
      id: 'topic_illness_l2',
      title: 'Болезни, уровень 2',
      description: 'Самочувствие, отделения больницы, лекарства и как их принимать.',
      kind: TopicKind.VOCABULARY,
      authorId: teacher.id,
      words: illnessL2Words,
    },
  });

  const snu3a1Words = [
    { ko: '설레다', ru: 'волноваться (от предвкушения)', roman: 'seolleda' },
    { ko: '떨리다', ru: 'дрожать, нервничать', roman: 'tteollida' },
    { ko: '낯설다', ru: 'непривычный, чужой', roman: 'natseolda' },
    { ko: '자신이 있다/없다', ru: 'быть уверенным / неуверенным', roman: 'jasini itda/eopda' },
    { ko: '만족하다', ru: 'быть довольным', roman: 'manjokhada' },
    { ko: '인상적이다', ru: 'впечатляющий', roman: 'insangjeogida' },
    { ko: '서투르다', ru: 'неумелый', roman: 'seotureuda' },
    { ko: '적응하다', ru: 'адаптироваться', roman: 'jeogeunghada' },
    { ko: '정이 들다', ru: 'привязаться', roman: 'jeongi deulda' },
    { ko: '잊지 못하다', ru: 'не мочь забыть', roman: 'itji mothada' },
    { ko: '입학 설명회', ru: 'собрание для поступающих', roman: 'iphak seolmyeonghoe' },
    { ko: '입학식', ru: 'церемония поступления', roman: 'iphaksik' },
    { ko: '신입생 환영회', ru: 'вечер встречи первокурсников', roman: 'sinipsaeng hwanyeonghoe' },
    { ko: '졸업식', ru: 'выпускной', roman: 'joreopsik' },
    { ko: '학교에 지원하다', ru: 'подавать документы в вуз', roman: 'hakgyoe jiwonhada' },
    { ko: '경제학을 전공하다', ru: 'специализироваться на экономике', roman: 'gyeongjehageul jeongonghada' },
    { ko: '학생증을 발급받다', ru: 'получить студенческий билет', roman: 'haksaengjeungeul balgeupbatda' },
    { ko: '개강 모임에 참석하다', ru: 'прийти на встречу к началу семестра', roman: 'gaegang moime chamseokhada' },
    { ko: '강의를 듣다', ru: 'слушать лекцию', roman: 'ganguireul deutda' },
    { ko: '체육 대회에 참가하다', ru: 'участвовать в спортивном празднике', roman: 'cheyuk daehoee chamgahada' },
  ];

  await prisma.topic.upsert({
    where: { id: 'topic_snu_3a_1' },
    update: {
      title: '서울대 3A, 1과 새로운 생활',
      description: 'Новая жизнь: чувства и учёба в университете.',
      words: snu3a1Words,
    },
    create: {
      id: 'topic_snu_3a_1',
      title: '서울대 3A, 1과 새로운 생활',
      description: 'Новая жизнь: чувства и учёба в университете.',
      kind: TopicKind.VOCABULARY,
      authorId: teacher.id,
      words: snu3a1Words,
    },
  });

  const bodySymptomsWords = [
    { ko: '가슴', ru: 'грудь', roman: 'gaseum' },
    { ko: '다리', ru: 'нога', roman: 'dari' },
    { ko: '머리', ru: 'голова', roman: 'meori' },
    { ko: '목', ru: 'шея, горло', roman: 'mok' },
    { ko: '몸', ru: 'тело', roman: 'mom' },
    { ko: '무릎', ru: 'колено', roman: 'mureup' },
    { ko: '발', ru: 'стопа', roman: 'bal' },
    { ko: '배', ru: 'живот', roman: 'bae' },
    { ko: '손', ru: 'рука, кисть', roman: 'son' },
    { ko: '어깨', ru: 'плечо', roman: 'eokkae' },
    { ko: '팔', ru: 'рука', roman: 'pal' },
    { ko: '허리', ru: 'поясница', roman: 'heori' },
    { ko: '귀', ru: 'ухо', roman: 'gwi' },
    { ko: '눈', ru: 'глаз', roman: 'nun' },
    { ko: '얼굴', ru: 'лицо', roman: 'eolgul' },
    { ko: '입', ru: 'рот', roman: 'ip' },
    { ko: '코', ru: 'нос', roman: 'ko' },
    { ko: '기침(을) 하다', ru: 'кашлять', roman: 'gichimeul hada' },
    { ko: '목이 아프다', ru: 'болит горло', roman: 'mogi apeuda' },
    { ko: '열이 나다[있다]', ru: 'температура', roman: 'yeori nada/itda' },
    { ko: '콧물이 나다', ru: 'насморк', roman: 'konmuri nada' },
  ];

  await prisma.topic.upsert({
    where: { id: 'topic_body_symptoms' },
    update: {
      title: 'Тело, симптомы',
      description: 'Части тела и простые симптомы: кашель, горло, температура, насморк.',
      words: bodySymptomsWords,
    },
    create: {
      id: 'topic_body_symptoms',
      title: 'Тело, симптомы',
      description: 'Части тела и простые симптомы: кашель, горло, температура, насморк.',
      kind: TopicKind.VOCABULARY,
      authorId: teacher.id,
      words: bodySymptomsWords,
    },
  });

  await prisma.topic.upsert({
    where: { id: 'topic_eu_irregular' },
    update: {
      title: 'Нерегулярные глаголы на 으',
      description: 'ㅡ-неправильные: при спряжении ㅡ выпадает (크다 → 커요).',
      words: euIrregularWords,
    },
    create: {
      id: 'topic_eu_irregular',
      title: 'Нерегулярные глаголы на 으',
      description: 'ㅡ-неправильные: при спряжении ㅡ выпадает (크다 → 커요).',
      kind: TopicKind.VOCABULARY,
      authorId: teacher.id,
      words: euIrregularWords,
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
