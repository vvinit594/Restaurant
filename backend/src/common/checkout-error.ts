import { clientSafeRazorpayReason } from '../payments/razorpay-diagnostics';

export const CHECKOUT_INIT_FAILED = 'RAZORPAY_CHECKOUT_INITIALIZATION_FAILED';
export const CHECKOUT_PLAN_UNAVAILABLE = 'RAZORPAY_PLAN_UNAVAILABLE';

export type CheckoutErrorBody = {
  success: false;
  code: typeof CHECKOUT_INIT_FAILED | typeof CHECKOUT_PLAN_UNAVAILABLE;
  message: string;
  paymentRequired: true;
  restaurantId?: string;
  reason?: string;
};

export function checkoutErrorBody(input?: {
  planUnavailable?: boolean;
  restaurantId?: string | null;
  reason?: string | null;
}): CheckoutErrorBody {
  const restaurantId = String(input?.restaurantId || '').trim();
  const reason = clientSafeRazorpayReason(input?.reason);
  const detail =
    reason ||
    (input?.planUnavailable
      ? 'Razorpay payment plan is not available for the current account.'
      : '');
  const sentence = detail ? (detail.endsWith('.') ? detail : `${detail}.`) : '';
  const message = [
    'Razorpay payment setup failed.',
    sentence,
    'Please retry Razorpay Checkout.',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    success: false,
    code: input?.planUnavailable ? CHECKOUT_PLAN_UNAVAILABLE : CHECKOUT_INIT_FAILED,
    message,
    paymentRequired: true,
    ...(reason ? { reason } : {}),
    ...(restaurantId ? { restaurantId } : {}),
  };
}

export function readCheckoutErrorBody(err: unknown): CheckoutErrorBody | null {
  if (!err || typeof err !== 'object' || !('getResponse' in err)) return null;
  const target = err as { getResponse?: () => unknown };
  if (typeof target.getResponse !== 'function') return null;
  let body: unknown;
  try {
    body = target.getResponse();
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object') return null;
  const code = (body as { code?: unknown }).code;
  if (code !== CHECKOUT_INIT_FAILED && code !== CHECKOUT_PLAN_UNAVAILABLE) return null;
  return body as CheckoutErrorBody;
}

/**
 * Duck-typed so a bundled second copy of @nestjs/common cannot turn a
 * Service Unavailable response into a generic HTTP 500.
 */
export function readHttpException(
  exception: unknown,
): { status: number; body: unknown } | null {
  if (!exception || (typeof exception !== 'object' && typeof exception !== 'function')) {
    return null;
  }
  const value = exception as {
    getStatus?: () => number;
    getResponse?: () => unknown;
  };
  if (typeof value.getStatus !== 'function' || typeof value.getResponse !== 'function') {
    return null;
  }
  try {
    const status = value.getStatus();
    if (typeof status !== 'number' || status < 400 || status > 599) return null;
    return { status, body: value.getResponse() };
  } catch {
    return null;
  }
}

export function isPaidCheckoutRequest(method: string, url: string): boolean {
  if (String(method || '').toUpperCase() !== 'POST') return false;
  const path = String(url || '').split('?')[0];
  return (
    /\/admin\/restaurants\/?$/.test(path) ||
    /\/sales\/restaurants\/?$/.test(path) ||
    /\/payments\/admin\/restaurants\/[^/]+\/checkout\/?$/.test(path) ||
    /\/payments\/restaurant\/checkout\/?$/.test(path) ||
    /\/sales\/restaurants\/[^/]+\/checkout\/?$/.test(path)
  );
}
