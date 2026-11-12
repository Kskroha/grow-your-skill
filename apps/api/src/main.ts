import 'reflect-metadata';
import { existsSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ensureUploadDirs, UPLOADS_DIR } from './uploads';

if (process.env.DATABASE_URL && !/sslmode=/i.test(process.env.DATABASE_URL)) {
  const local = /localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL);
  process.env.DATABASE_URL +=
    (process.env.DATABASE_URL.includes('?') ? '&' : '?') + (local ? 'sslmode=disable' : 'sslmode=require');
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  ensureUploadDirs();
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' });
  app.setGlobalPrefix('api');
  const frontend = process.env.FRONTEND_ORIGIN;
  app.enableCors({
    origin: frontend ? frontend.split(',') : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const webDist = process.env.WEB_DIST;
  if (webDist && existsSync(webDist)) {
    app.useStaticAssets(webDist);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        next();
        return;
      }
      res.sendFile(join(webDist, 'index.html'));
    });
  }
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

bootstrap();
