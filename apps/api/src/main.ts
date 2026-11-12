import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ensureUploadDirs, UPLOADS_DIR } from './uploads';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  ensureUploadDirs();
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

bootstrap();
