import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      res.status(status).json(
        typeof payload === 'string'
          ? { statusCode: status, message: payload }
          : payload,
      );
      return;
    }

    const err = exception as {
      name?: string;
      code?: string;
      message?: string;
      meta?: unknown;
      stack?: string;
    };
    this.logger.error(
      `${req.method} ${req.originalUrl || req.url} ${err?.name || 'Error'} ${err?.code || ''} ${err?.message || exception}`,
      err?.stack,
    );

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
