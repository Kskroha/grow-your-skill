# Тренажёр корейского

Кабинет для небольшой группы: учитель ведёт каталог и назначает упражнения, ученик проходит карточки, тесты, письмо и устную речь. Прогресс сохраняется.

Стек: React (Vite), NestJS, PostgreSQL, Prisma.

Учеников создаёт только учитель из своего кабинета. Почта и пароль учителя задаются в `.env` (`TEACHER_EMAIL`, `TEACHER_PASSWORD`) и в репозиторий не попадают.

## Локальный запуск

Нужны Node 20+ и Postgres.

```bash
cp .env.example .env
npm run setup
npm run dev:api
npm run dev:web
```

Сайт: [http://localhost:5173](http://localhost:5173).

## Деплой

Публичный сайт на Render (один адрес для кабинета и API):

[Деплой на Render](https://render.com/deploy?repo=https://github.com/Kskroha/grow-your-skill)

После создания сервиса ссылка будет вида `https://grow-your-skill.onrender.com`. В Environment на Render задайте `TEACHER_EMAIL` и `TEACHER_PASSWORD`.

Локально через Docker:

```bash
cp .env.example .env
docker compose up --build -d
```

Сайт: порт `8080`. Перед запуском заполните `.env`: `JWT_SECRET`, `TEACHER_EMAIL`, `TEACHER_PASSWORD`.
