import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import express from 'express';

import { AppModule } from './app.module';

const server = express();

let appInitialized = false;
let bootPromise: Promise<void> | null = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });

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

  const allowedOrigins = (
    config.get<string>('FRONTEND_ORIGIN') || 'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.init();
  appInitialized = true;
}

/** Single-flight Nest init — required for Vercel cold starts. */
function ensureApp(): Promise<void> {
  if (appInitialized) return Promise.resolve();
  if (!bootPromise) {
    bootPromise = bootstrap().catch((err) => {
      bootPromise = null;
      appInitialized = false;
      throw err;
    });
  }
  return bootPromise;
}

// Gate every request until Nest is ready (fixes flaky 500/404 on cold start).
server.use(async (_req, res, next) => {
  try {
    await ensureApp();
    next();
  } catch (err) {
    console.error('Nest bootstrap failed:', err);
    res.status(503).json({
      statusCode: 503,
      message: 'API is starting up. Retry in a moment.',
    });
  }
});

// Export the Express server for Vercel.
export default server;

// Local development only.
if (!process.env.VERCEL) {
  ensureApp().then(() => {
    const port = Number(process.env.PORT || 3001);
    server.listen(port, () => {
      console.log(`DilYum API listening on http://localhost:${port}/api/v1`);
    });
  });
}
