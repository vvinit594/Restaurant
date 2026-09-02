import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

type Bucket = { count: number; resetAt: number };

/**
 * ponytail: in-process public order throttle (single-instance).
 * Upgrade path: Redis when multi-instance.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 40;
const buckets = new Map<string, Bucket>();

@Injectable()
export class PublicOrderRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = String(
      req.ip ||
        req.headers['x-forwarded-for'] ||
        req.socket?.remoteAddress ||
        'unknown',
    );
    const key = `public-order:${ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many orders from this device. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
