/**
 * Canonical DilYum restaurant subscription plans (source of truth).
 * Codes are stable DB identifiers — never trust client-sent prices.
 */

export type PlanCode = 'MONTHLY' | 'LAUNCH';

export const ACTIVE_PLAN_CODES: PlanCode[] = ['MONTHLY', 'LAUNCH'];

export const LEGACY_PLAN_CODES = [
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'ENTERPRISE',
] as const;

export const SUBSCRIPTION_PLANS = {
  MONTHLY: {
    code: 'MONTHLY' as const,
    name: 'Monthly Plan',
    priceLabel: '₹1,499 / Month',
    priceAmount: 1499,
    billingMonths: 1,
    branchLimit: 5,
    badge: 'MOST POPULAR',
    description: 'Perfect for Established Restaurants',
    specialNotice: null as string | null,
    isNewRestaurantOnly: false,
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
    branchLimit: 5,
    badge: 'LAUNCH PLAN',
    description: 'Special Launch Plan for New Restaurants',
    specialNotice: 'Monthly trial plan only new restaurant',
    isNewRestaurantOnly: true,
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

export function getPlanConfig(code: string) {
  const key = String(code || '')
    .trim()
    .toUpperCase() as PlanCode;
  return SUBSCRIPTION_PLANS[key] || null;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
