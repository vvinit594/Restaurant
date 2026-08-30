import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import { config as loadEnv } from 'dotenv';

import { AppModule } from './app.module';

// Local .env before reading FRONTEND_ORIGIN for early CORS.
loadEnv();

const server = express();

let appInitialized = false;
let bootPromise: Promise<void> | null = null;

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'https://dilyum.live',
  'https://www.dilyum.live',
];

function buildAllowedOrigins(frontendOriginEnv?: string) {
  return Array.from(
    new Set([
      ...DEFAULT_ORIGINS,
      ...(frontendOriginEnv || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ]),
  );
}

/**
 * Apply CORS on the raw Express app before Nest boots / handles the request.
 * Ensures OPTIONS preflight and error responses (incl. cold-start 503) always
 * carry Access-Control-Allow-Origin for allowed frontends — never '*'.
 */
function applyExpressCors(allowedOrigins: string[]) {
  server.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      );
      const requested = req.headers['access-control-request-headers'];
      res.setHeader(
        'Access-Control-Allow-Headers',
        typeof requested === 'string' && requested.trim()
          ? requested
          : 'Authorization,Content-Type,Accept',
      );
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    next();
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const allowedOrigins = buildAllowedOrigins(
    config.get<string>('FRONTEND_ORIGIN'),
  );

  // Images go to Supabase Storage; JSON payloads only carry short URLs.
  // Phase 1: keep 1mb global — enough for auth/CRUD JSON; not for Base64 images.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

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

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
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

// CORS must run before the bootstrap gate so preflight/503 always get headers.
applyExpressCors(buildAllowedOrigins(process.env.FRONTEND_ORIGIN));

// Gate every request until Nest is ready (fixes flaky 500/404 on cold start).
server.use(async (req, res, next) => {
  try {
    await ensureApp();
    next();
  } catch (err) {
    console.error('Nest bootstrap failed:', err);
    // CORS headers already set by applyExpressCors when Origin is allowed.
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
