import {
  isValidRazorpayPlanId,
  planConfigurationError,
  planMissingOnAccount,
  publicRazorpayText,
  razorpayErrorDetails,
  razorpayFailureLog,
  razorpayKeyMode,
} from './razorpay-diagnostics';

describe('Razorpay diagnostics', () => {
  it('reads the SDK error shape thrown by the Razorpay client', () => {
    const details = razorpayErrorDetails({
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST_ERROR',
        description: 'The id provided does not exist',
        field: 'plan_id',
        reason: 'input_validation_failed',
      },
    });
    expect(details.status).toBe(400);
    expect(details.code).toBe('BAD_REQUEST_ERROR');
    expect(details.description).toBe('The id provided does not exist');
    expect(details.field).toBe('plan_id');
    expect(planMissingOnAccount(details)).toBe(true);
  });

  it('redacts key material from a description', () => {
    const text = publicRazorpayText(
      'auth failed rzp_live_abcdefghijklmnop Basic dGVzdA==',
    );
    expect(text).not.toContain('rzp_live_');
    expect(text).not.toContain('dGVzdA');
    expect(text).toContain('[redacted-key]');
  });

  it('classifies key mode without returning the key', () => {
    expect(razorpayKeyMode('rzp_live_abc')).toBe('live');
    expect(razorpayKeyMode('rzp_test_abc')).toBe('test');
    expect(razorpayKeyMode('')).toBe('unknown');
  });

  it('accepts only a 19-character plan id', () => {
    expect(isValidRazorpayPlanId('plan_12345678901234')).toBe(true);
    expect(isValidRazorpayPlanId('plan_short')).toBe(false);
    expect(isValidRazorpayPlanId('')).toBe(false);
  });

  it('rejects a plan whose amount or cycle does not match DilYum', () => {
    expect(
      planConfigurationError('MONTHLY', {
        period: 'monthly',
        interval: 1,
        item: { amount: 149900, currency: 'INR' },
      }),
    ).toBeNull();
    expect(
      planConfigurationError('LAUNCH', {
        period: 'monthly',
        interval: 1,
        item: { amount: 299900, currency: 'INR' },
      }),
    ).toMatch(/billing cycle/);
    expect(
      planConfigurationError('MONTHLY', {
        period: 'monthly',
        interval: 1,
        item: { amount: 100, currency: 'INR' },
      }),
    ).toMatch(/amount/);
  });

  it('logs operation context without a plan id or secret', () => {
    const line = razorpayFailureLog({
      operation: 'create subscription',
      restaurantId: 'rest_1',
      planType: 'MONTHLY',
      details: razorpayErrorDetails({
        statusCode: 400,
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'The id provided does not exist',
        },
      }),
    });
    expect(line).toContain('restaurantId=rest_1');
    expect(line).toContain('planType=MONTHLY');
    expect(line).toContain('status=400');
    expect(line).toContain('code=BAD_REQUEST_ERROR');
    expect(line).not.toContain('plan_');
    expect(line).not.toContain('rzp_');
  });
});
