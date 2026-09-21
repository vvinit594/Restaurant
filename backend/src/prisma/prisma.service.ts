import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
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
