import { getPlanConfig } from '../common/subscription-plans';

export type RazorpayErrorDetails = {
  status: number | null;
  code: string | null;
  description: string | null;
  field: string | null;
  reason: string | null;
};

export type RazorpayPlanSnapshot = {
  period?: string | null;
  interval?: number | string | null;
  item?: { amount?: number | string | null; currency?: string | null } | null;
};

/** Strip credentials if a gateway error echoes them. */
export function publicRazorpayText(value: string): string {
  return value
    .replace(/rzp_(?:live|test)_[A-Za-z0-9]+/g, '[redacted-key]')
    .replace(/\b(?:key_secret|webhook_secret)\b\s*[:=]?\s*\S+/gi, '[redacted]')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function razorpayKeyMode(keyId: string): 'live' | 'test' | 'unknown' {
  if (keyId.startsWith('rzp_live_')) return 'live';
  if (keyId.startsWith('rzp_test_')) return 'test';
  return 'unknown';
}

/** Razorpay plan ids are `plan_` plus 14 characters (19 total). */
export function isValidRazorpayPlanId(value: string): boolean {
  return /^plan_[A-Za-z0-9]{14}$/.test(value);
}

export function razorpayErrorDetails(err: unknown): RazorpayErrorDetails {
  const e = err as {
    statusCode?: number;
    description?: string;
    message?: string;
    error?: {
      code?: string;
      description?: string;
      field?: string;
      reason?: string;
    };
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: string;
          description?: string;
          field?: string;
          reason?: string;
        };
      };
    };
    getResponse?: () => unknown;
  };
  const nested =
    e?.error && typeof e.error === 'object'
      ? e.error
      : e?.response?.data?.error;
  let description = nested?.description || e?.description || null;
  if (!description && typeof e?.getResponse === 'function') {
    const body = e.getResponse();
    if (typeof body === 'string' && body.trim()) description = body.trim();
    else if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) description = message.trim();
      else if (Array.isArray(message)) {
        description = message.filter((item) => typeof item === 'string').join(', ');
      }
    }
  }
  if (!description && typeof e?.message === 'string' && e.message.trim()) {
    description = e.message.trim();
  }
  const status =
    typeof e?.statusCode === 'number'
      ? e.statusCode
      : typeof e?.response?.status === 'number'
        ? e.response.status
        : null;
  return {
    status,
    code: nested?.code || null,
    description: description ? publicRazorpayText(description) : null,
    field: nested?.field || null,
    reason: nested?.reason || null,
  };
}

export function razorpayFailureLog(input: {
  operation: string;
  restaurantId?: string | null;
  planType?: string | null;
  details: RazorpayErrorDetails;
}): string {
  return [
    `[Razorpay] Failed to ${input.operation}`,
    input.restaurantId ? `restaurantId=${input.restaurantId}` : '',
    input.planType ? `planType=${input.planType}` : '',
    `status=${input.details.status ?? 'unknown'}`,
    `code=${input.details.code ?? 'none'}`,
    `description=${input.details.description ?? 'none'}`,
    input.details.field ? `field=${input.details.field}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function planMissingOnAccount(details: RazorpayErrorDetails): boolean {
  const description = details.description || '';
  return (
    (details.status === 400 || details.status === 404) &&
    /does not exist/i.test(description)
  );
}

/**
 * Returns a client-safe sentence when the Live/Test plan does not match
 * the DilYum price and billing cycle. Null means the plan is acceptable.
 */
export function planConfigurationError(
  planCode: string,
  plan: RazorpayPlanSnapshot | null | undefined,
): string | null {
  const config = getPlanConfig(planCode);
  if (!config || !config.paymentRequired) return null;
  const label = config.priceLabel;
  if (!plan) return `Razorpay did not return the ${planCode} plan.`;
  const currency = String(plan.item?.currency || '').toUpperCase();
  const amount = Number(plan.item?.amount);
  const period = String(plan.period || '').toLowerCase();
  const interval = Number(plan.interval);
  const expectedPaise = Math.round(Number(config.priceAmount) * 100);
  if (currency !== 'INR') {
    return `The ${planCode} Razorpay plan must charge INR (${label}).`;
  }
  if (!Number.isFinite(amount) || amount !== expectedPaise) {
    return `The ${planCode} Razorpay plan amount does not match ${label}.`;
  }
  if (period !== 'monthly' || interval !== Number(config.billingMonths)) {
    return `The ${planCode} Razorpay plan billing cycle does not match ${label}.`;
  }
  return null;
}
