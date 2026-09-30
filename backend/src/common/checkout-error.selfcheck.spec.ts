import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import {
  CHECKOUT_PLAN_UNAVAILABLE,
  checkoutErrorBody,
  isPaidCheckoutRequest,
  readCheckoutErrorBody,
  readHttpException,
} from './checkout-error';

describe('checkout error responses', () => {
  it('uses a controlled plan-unavailable body', () => {
    const body = checkoutErrorBody({
      planUnavailable: true,
      restaurantId: 'rest_1',
    });
    expect(body.success).toBe(false);
    expect(body.code).toBe(CHECKOUT_PLAN_UNAVAILABLE);
    expect(body.message).toBe(
      'The selected Razorpay Live plan is not available. Please contact the platform administrator.',
    );
    expect(body.paymentRequired).toBe(true);
    expect(body.restaurantId).toBe('rest_1');
    expect(JSON.stringify(body)).not.toMatch(/rzp_|secret|authorization/i);
  });

  it('includes a sanitized Razorpay reason and drops key material', () => {
    const body = checkoutErrorBody({
      restaurantId: 'rest_1',
      reason: 'Authentication failed for rzp_live_abcdefghijklmnop',
    });
    expect(body.code).toBe('RAZORPAY_CHECKOUT_INITIALIZATION_FAILED');
    expect(body.message).toBe(
      'Razorpay payment setup failed. Please retry Razorpay Checkout.',
    );
    expect(JSON.stringify(body)).not.toContain('rzp_live_');
    expect(JSON.stringify(body)).not.toContain('abcdefghijklmnop');
  });

  it('reads a ServiceUnavailableException without detaching getResponse', () => {
    const exception = new ServiceUnavailableException(
      checkoutErrorBody({ planUnavailable: true, restaurantId: 'rest_1' }),
    );
    const detached = exception.getResponse;
    expect(() => detached()).toThrow(/response/);
    expect(readCheckoutErrorBody(exception)?.code).toBe(CHECKOUT_PLAN_UNAVAILABLE);
    expect(readCheckoutErrorBody(exception)?.restaurantId).toBe('rest_1');
  });

  it('reads HttpException status without relying on instanceof', () => {
    const exception = new HttpException(
      checkoutErrorBody({ planUnavailable: true }),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    const read = readHttpException(exception);
    expect(read?.status).toBe(503);
    expect((read?.body as { code?: string }).code).toBe(CHECKOUT_PLAN_UNAVAILABLE);
  });

  it('recognizes paid create and checkout routes only', () => {
    expect(isPaidCheckoutRequest('POST', '/api/v1/admin/restaurants')).toBe(true);
    expect(
      isPaidCheckoutRequest(
        'POST',
        '/api/v1/payments/admin/restaurants/abc/checkout',
      ),
    ).toBe(true);
    expect(isPaidCheckoutRequest('GET', '/api/v1/admin/restaurants')).toBe(false);
    expect(isPaidCheckoutRequest('POST', '/api/v1/public/restaurants')).toBe(false);
  });
});
