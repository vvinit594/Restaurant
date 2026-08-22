import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  // Allow logo/cover data URLs until cloud media upload is wired (default Express limit is 100kb)
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const origin = config.get<string>('FRONTEND_ORIGIN') || 'http://localhost:3000';
  app.enableCors({
    origin,
    credentials: true,
  });

  const port = Number(config.get('PORT') || 3001);
  await app.listen(port);
  console.log(`DilYum API listening on http://localhost:${port}/api/v1`);
}
bootstrap();
