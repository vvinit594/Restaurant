/**
 * Canonical DilYum restaurant subscription plans (source of truth).
 * Codes are stable DB identifiers — never trust client-sent prices.
 *
 * Frontend / API ids are lowercase codes (e.g. trial_10_days, monthly, launch).
 */

export type PlanCode = 'TRIAL_10_DAYS' | 'MONTHLY' | 'LAUNCH';

export type PlanType = 'FREE_TRIAL' | 'PAID';

export const ACTIVE_PLAN_CODES: PlanCode[] = [
  'TRIAL_10_DAYS',
  'MONTHLY',
  'LAUNCH',
];

export const LEGACY_PLAN_CODES = [
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'ENTERPRISE',
] as const;

export const SUBSCRIPTION_PLANS = {
  TRIAL_10_DAYS: {
    code: 'TRIAL_10_DAYS' as const,
    name: '10 Days Free Trial',
    priceLabel: '₹0 / 10 Days',
    priceAmount: 0,
    billingMonths: 0,
    billingDays: 10,
    branchLimit: 5,
    badge: 'FREE TRIAL',
    description: 'Free Trial for New Restaurants',
    specialNotice: 'No payment required during the trial period',
    isNewRestaurantOnly: true,
    planType: 'FREE_TRIAL' as const,
    paymentRequired: false,
    ctaLabel: 'Start Free Trial',
    theme: 'trial' as const,
    sortOrder: 0,
    features: [
      'Digital Menu & QR Code',
      'Loyalty Program',
      'Analytics & Insights',
      'Regular Updates & Support',
    ],
  },
  MONTHLY: {
    code: 'MONTHLY' as const,
    name: 'Monthly Plan',
    priceLabel: '₹1,499 / Month',
    priceAmount: 1499,
    billingMonths: 1,
    billingDays: 0,
    branchLimit: 5,
    badge: 'MOST POPULAR',
    description: 'Perfect for Established Restaurants',
    specialNotice: null as string | null,
    isNewRestaurantOnly: false,
    planType: 'PAID' as const,
    paymentRequired: true,
    ctaLabel: 'Choose Monthly Plan',
    theme: 'orange' as const,
    sortOrder: 1,
    features: [
      'Digital Menu & QR Code',
      'Loyalty Program',
      'Analytics & Insights',
      'Regular Updates & Support',
    ],
  },
  LAUNCH: {
    code: 'LAUNCH' as const,
    name: 'Launch Plan',
    priceLabel: '₹2,999 / 3 Months',
    priceAmount: 2999,
    billingMonths: 3,
    billingDays: 0,
    branchLimit: 5,
    badge: 'LAUNCH PLAN',
    description: 'Special Launch Plan for New Restaurants',
    specialNotice: 'Monthly trial plan only new restaurant',
    isNewRestaurantOnly: true,
    planType: 'PAID' as const,
    paymentRequired: true,
    ctaLabel: 'Choose Launch Plan',
    theme: 'blue' as const,
    sortOrder: 2,
    features: [
      'Digital Menu & QR Code',
      'Loyalty Program',
      'Analytics & Insights',
      'Regular Updates & Support',
    ],
  },
} as const;

export function normalizePlanCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');
}

export function getPlanConfig(code: string) {
  const key = normalizePlanCode(code) as PlanCode;
  return SUBSCRIPTION_PLANS[key] || null;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Compute subscription end from trusted plan config / DB fields. */
export function computeSubscriptionEndsAt(
  startedAt: Date,
  plan: {
    billingDays?: number | null;
    billingMonths?: number | null;
  },
): Date {
  const days = Number(plan.billingDays || 0);
  if (days > 0) return addDays(startedAt, days);
  const months = Number(plan.billingMonths || 0);
  if (months > 0) return addMonths(startedAt, months);
  return addDays(startedAt, 0);
}

export function isPaymentRequiredForPlan(code: string): boolean {
  const config = getPlanConfig(code);
  if (!config) return true;
  return config.paymentRequired !== false && Number(config.priceAmount) > 0;
}

/** Map DilYum plan → Razorpay Plan ID from trusted env (never from client). */
export function getRazorpayPlanIdFromEnv(
  code: string,
  env: {
    RAZORPAY_MONTHLY_PLAN_ID?: string;
    RAZORPAY_LAUNCH_PLAN_ID?: string;
  },
): string | null {
  const key = normalizePlanCode(code);
  if (key === 'MONTHLY') {
    return String(env.RAZORPAY_MONTHLY_PLAN_ID || '').trim() || null;
  }
  if (key === 'LAUNCH') {
    return String(env.RAZORPAY_LAUNCH_PLAN_ID || '').trim() || null;
  }
  return null;
}

/** Subscription is currently usable (not expired / pending payment). */
export function isSubscriptionPeriodActive(
  status: string,
  endsAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (status !== 'ACTIVE' && status !== 'TRIAL') return false;
  if (!endsAt) return true;
  return new Date(endsAt).getTime() > now.getTime();
}

export function addGraceHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}
