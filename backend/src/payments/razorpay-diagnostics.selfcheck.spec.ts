import {
  getRazorpayPlanIdFromEnv,
  isPaymentRequiredForPlan,
} from '../common/subscription-plans';
import {
  classifyCheckoutFailure,
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
    expect(
      planMissingOnAccount({
        status: null,
        code: null,
        description: 'The id provided does not exist',
        field: null,
        reason: null,
      }),
    ).toBe(true);
    expect(
      planMissingOnAccount({
        status: 401,
        code: 'BAD_REQUEST_ERROR',
        description: 'Authentication failed',
        field: null,
        reason: null,
      }),
    ).toBe(false);
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
      operation: 'create_subscription',
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
    expect(line).toContain('operation: create_subscription');
    expect(line).toContain('restaurantId: rest_1');
    expect(line).toContain('planType: MONTHLY');
    expect(line).toContain('httpStatus: 400');
    expect(line).toContain('razorpayCode: BAD_REQUEST_ERROR');
    expect(line).not.toContain('plan_');
    expect(line).not.toContain('rzp_');
  });

  const livePlanNotFound = razorpayErrorDetails({
    statusCode: 400,
    error: {
      code: 'BAD_REQUEST_ERROR',
      description: 'The ID provided is invalid or could not be found.',
    },
  });

  it('classifies a missing Live plan id as plan unavailable', () => {
    expect(planMissingOnAccount(livePlanNotFound)).toBe(true);
    expect(
      classifyCheckoutFailure({ operation: 'fetch_plan', details: livePlanNotFound }),
    ).toBe('RAZORPAY_PLAN_UNAVAILABLE');
    expect(
      classifyCheckoutFailure({ operation: 'plan_id', planIdInvalid: true }),
    ).toBe('RAZORPAY_PLAN_UNAVAILABLE');
  });

  it('accepts a Monthly plan only at 149900 paise every 1 month', () => {
    expect(
      planConfigurationError('MONTHLY', {
        period: 'monthly',
        interval: 1,
        item: { amount: 149900, currency: 'INR' },
      }),
    ).toBeNull();
    expect(
      planConfigurationError('MONTHLY', {
        period: 'monthly',
        interval: 1,
        item: { amount: 99900, currency: 'INR' },
      }),
    ).toMatch(/amount/);
  });

  it('accepts a Launch plan only at 299900 paise every 3 months', () => {
    expect(
      planConfigurationError('LAUNCH', {
        period: 'monthly',
        interval: 3,
        item: { amount: 299900, currency: 'INR' },
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
      classifyCheckoutFailure({ operation: 'fetch_plan', planMismatch: true }),
    ).toBe('RAZORPAY_PLAN_MISMATCH');
  });

  it('maps Monthly and Launch to separate env ids and skips trial', () => {
    const env = {
      RAZORPAY_MONTHLY_PLAN_ID: 'plan_monthly123456',
      RAZORPAY_LAUNCH_PLAN_ID: 'plan_launch1234567',
    };
    expect(getRazorpayPlanIdFromEnv('MONTHLY', env)).toBe('plan_monthly123456');
    expect(getRazorpayPlanIdFromEnv('LAUNCH', env)).toBe('plan_launch1234567');
    expect(getRazorpayPlanIdFromEnv('MONTHLY', env)).not.toBe(
      getRazorpayPlanIdFromEnv('LAUNCH', env),
    );
    expect(getRazorpayPlanIdFromEnv('TRIAL_10_DAYS', env)).toBeNull();
    expect(isPaymentRequiredForPlan('TRIAL_10_DAYS')).toBe(false);
    expect(isPaymentRequiredForPlan('MONTHLY')).toBe(true);
  });

  it('classifies authentication, customer, and subscription failures separately', () => {
    expect(
      classifyCheckoutFailure({
        operation: 'fetch_plan',
        details: razorpayErrorDetails({ statusCode: 401, error: { code: 'AUTHENTICATION_ERROR', description: 'Authentication failed' } }),
      }),
    ).toBe('RAZORPAY_AUTHENTICATION_FAILED');
    expect(
      classifyCheckoutFailure({
        operation: 'create_customer',
        details: razorpayErrorDetails({ statusCode: 400, error: { code: 'BAD_REQUEST_ERROR', description: 'email is invalid' } }),
      }),
    ).toBe('RAZORPAY_CUSTOMER_CREATION_FAILED');
    expect(
      classifyCheckoutFailure({
        operation: 'create_subscription',
        details: razorpayErrorDetails({ statusCode: 400, error: { code: 'BAD_REQUEST_ERROR', description: 'total_count is invalid' } }),
      }),
    ).toBe('RAZORPAY_SUBSCRIPTION_CREATION_FAILED');
    expect(
      classifyCheckoutFailure({
        operation: 'create_subscription',
        details: livePlanNotFound,
      }),
    ).toBe('RAZORPAY_PLAN_UNAVAILABLE');
  });
});
