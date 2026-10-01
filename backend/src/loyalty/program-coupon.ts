export type ProgramCouponSpec = {
  code: string;
  title: string;
  description: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minimumOrderValue: number | null;
  maximumDiscount: number | null;
};

const PROGRAM_TITLES: Record<string, string> = {
  BIRTHDAY_REWARD: 'Birthday Reward',
  EXCLUSIVE_OFFERS: 'Exclusive Offer',
  CASHBACK: 'Cashback Reward',
  REFER_EARN: 'Refer & Earn',
  MEMBERSHIP_TIERS: 'Membership Reward',
  ORDER_STREAK: 'Order Streak',
  STAMP_CARD: 'Stamp Card',
  POINTS: 'Points Reward',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function positiveNumber(value: unknown) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

export function loyaltyProgramCoupon(program: {
  programType: string;
  configuration: unknown;
}): ProgramCouponSpec | null {
  const config = asRecord(program.configuration);
  if (!config) return null;

  const code = String(config.couponCode || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{3,32}$/.test(code)) return null;

  const percent = positiveNumber(config.discountPercent);
  const fixed = positiveNumber(config.discountValue ?? config.rewardValue);
  const requestedFixed = String(config.discountType || '').toUpperCase() === 'FIXED';
  const discountType = requestedFixed || (percent == null && fixed != null) ? 'FIXED' : 'PERCENT';
  const discountValue = discountType === 'FIXED' ? fixed : percent;
  if (discountValue == null) return null;
  if (discountType === 'PERCENT' && discountValue > 100) return null;

  const title = String(config.title || PROGRAM_TITLES[program.programType] || 'Loyalty offer').trim();
  const description = String(config.offerDescription || config.rewardDescription || '').trim();

  return {
    code,
    title: title || 'Loyalty offer',
    description: description || null,
    discountType,
    discountValue,
    minimumOrderValue: positiveNumber(config.minimumOrderValue),
    maximumDiscount: positiveNumber(config.maximumDiscount),
  };
}

export function readLinkedCouponId(configuration: unknown) {
  const config = asRecord(configuration);
  const id = config?.linkedCouponId;
  return typeof id === 'string' && id.trim() ? id : null;
}
