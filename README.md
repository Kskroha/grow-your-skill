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

Один сервер с Docker:

```bash
cp .env.example .env
docker compose up --build -d
```

Сайт: порт `8080`, API: `3000`. Перед запуском заполните `.env`: `JWT_SECRET`, `TEACHER_EMAIL`, `TEACHER_PASSWORD`. При старте API накатывает миграции и создаёт аккаунт учителя.

Образы собираются автоматически в GitHub Actions при пуше в `main` и публикуются в GitHub Container Registry.

Бэкап базы: `docker compose exec db pg_dump -U grow grow > backup.sql`.
