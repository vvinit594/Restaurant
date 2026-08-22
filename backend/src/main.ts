import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import express from 'express';

import { AppModule } from './app.module';

const server = express();

let appInitialized = false;

async function bootstrap() {
  if (appInitialized) {
    return;
  }

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
    {
      bodyParser: false,
    },
  );

  const config = app.get(ConfigService);

  // Allow logo/cover data URLs up to 15 MB.
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const origin =
    config.get<string>('FRONTEND_ORIGIN') ||
    'http://localhost:3000';

  app.enableCors({
    origin,
    credentials: true,
  });

  await app.init();

  appInitialized = true;

  return app;
}

// Export the Express server for Vercel.
export default server;

// Local development only.
if (!process.env.VERCEL) {
  bootstrap().then(() => {
    const port = Number(process.env.PORT || 3001);

    server.listen(port, () => {
      console.log(
        `DilYum API listening on http://localhost:${port}/api/v1`,
      );
    });
  });
}

// Initialize the Nest application when running on Vercel.
if (process.env.VERCEL) {
  bootstrap().catch((error) => {
    console.error('Failed to initialize NestJS application:', error);
  });
}