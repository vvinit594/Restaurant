import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import {
  json,
  urlencoded,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import express from 'express';
import { config as loadEnv } from 'dotenv';

import { AppModule } from './app.module';

// Local .env before reading FRONTEND_ORIGIN for early CORS.
loadEnv();

const server = express();

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'https://dilyum.live',
  'https://www.dilyum.live',
];

const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'Origin',
  'X-Requested-With',
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
 * CORS on the shared Express instance before Nest finishes booting.
 * Never use origin '*'. Preflight must succeed for https://www.dilyum.live.
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
          : CORS_ALLOWED_HEADERS.join(','),
      );
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    next();
  });
}

applyExpressCors(buildAllowedOrigins(process.env.FRONTEND_ORIGIN));

// Razorpay webhook raw body (before Nest JSON parser).
server.use(
  '/api/v1/payments/razorpay/webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  (req: Request & { rawBody?: Buffer }, _res, next: NextFunction) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      try {
        (req as any).body = JSON.parse(req.body.toString('utf8'));
      } catch {
        (req as any).body = {};
      }
    }
    next();
  },
);

/**
 * Vercel NestJS zero-config requires bootstrap() + app.listen().
 * Do not use framework:null + /api rewrites — those produced edge NOT_FOUND.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const allowedOrigins = buildAllowedOrigins(
    config.get<string>('FRONTEND_ORIGIN'),
  );

  app.use(
    (req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) => {
      if (
        req.originalUrl?.includes('/payments/razorpay/webhook') &&
        req.rawBody
      ) {
        return next();
      }
      return json({ limit: '1mb' })(req, res, next);
    },
  );
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
    allowedHeaders: CORS_ALLOWED_HEADERS,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  if (!process.env.VERCEL) {
    console.log(`DilYum API listening on http://localhost:${port}/api/v1`);
  }
}

bootstrap().catch((err) => {
  console.error('Nest bootstrap failed:', err);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});
