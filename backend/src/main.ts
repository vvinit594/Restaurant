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
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

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
  'X-Device-Id',
  'X-Device-Secret',
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

/**
 * Capture original JSON bytes for Razorpay HMAC.
 * Must run as json()'s verify callback — never JSON.stringify a parsed object.
 */
function attachJsonRawBody(
  req: Request & { rawBody?: Buffer },
  _res: Response,
  buf: Buffer,
) {
  if (buf?.length && !req.rawBody) {
    req.rawBody = Buffer.from(buf);
  }
}

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
    json({
      limit: '2mb',
      verify: attachJsonRawBody,
    }),
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
  app.useGlobalFilters(new AllExceptionsFilter());

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
