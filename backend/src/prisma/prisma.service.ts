import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Vercel (many short-lived isolates) + Supabase session pooler (port 5432)
 * exhausts pool_size ~15: EMAXCONNSESSION.
 * Use transaction pooler (6543) and one Prisma connection per isolate.
 */
export function serverlessDatabaseUrl(raw?: string): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '20');
    if (url.hostname.includes('pooler.supabase.com')) {
      if (!url.port || url.port === '5432') {
        url.port = '6543';
      }
      url.searchParams.set('pgbouncer', 'true');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: { url: serverlessDatabaseUrl(process.env.DATABASE_URL) },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      // Do not crash the whole serverless function on a transient DB connect failure.
      console.error('Prisma $connect failed during bootstrap:', err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
