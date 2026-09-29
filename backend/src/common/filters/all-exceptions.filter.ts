import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  checkoutErrorBody,
  isPaidCheckoutRequest,
  readHttpException,
} from '../checkout-error';
import {
  planMissingOnAccount,
  razorpayErrorDetails,
} from '../../payments/razorpay-diagnostics';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const url = req.originalUrl || req.url || '';

    const httpException = readHttpException(exception);
    if (httpException) {
      const payload = httpException.body;
      res.status(httpException.status).json(
        typeof payload === 'string'
          ? { statusCode: httpException.status, message: payload }
          : payload,
      );
      return;
    }

    const err = exception as {
      name?: string;
      code?: string;
      message?: string;
      stack?: string;
    };
    const details = razorpayErrorDetails(exception);
    const safeMessage = String(details.description || err?.message || exception || '')
      .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
      .replace(/rzp_(?:live|test)_[A-Za-z0-9]+/g, '[redacted-key]')
      .slice(0, 240);
    this.logger.error(
      `${req.method} ${url} ${err?.name || 'Error'} ${err?.code || details.code || ''} ${safeMessage}`,
    );

    if (
      isPaidCheckoutRequest(req.method, url) &&
      (details.status != null || details.code || planMissingOnAccount(details))
    ) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(
        checkoutErrorBody({ planUnavailable: planMissingOnAccount(details) }),
      );
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
