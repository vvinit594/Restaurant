/**
 * Authoritative sales commission from the number of restaurants a sales person
 * has added. Totals are cumulative, not per-restaurant multiples.
 *
 * 1 → 400, 2 → 850, 3 → 1300, 4 → 1800, 5 → 2500
 * 6+ → 2500 + (count - 5) * 500
 */

export const COMMISSION_TOTALS_THROUGH_FIVE = [0, 400, 850, 1300, 1800, 2500] as const;
export const COMMISSION_AFTER_FIFTH = 500;

export type CommissionBreakdownRow = {
  restaurantNumber: number;
  label: string;
  amount: number;
};

export type CommissionRuleRow = {
  label: string;
  totalCommission: number | null;
  additionalRate: number | null;
};

export type RestaurantCommission = {
  restaurantCount: number;
  totalCommission: number;
  currentTier: string;
  additionalRestaurantRate: number;
  nextRestaurantAmount: number;
  rules: CommissionRuleRow[];
  breakdown: CommissionBreakdownRow[];
};

export function commissionTotalForCount(restaurantCount: number): number {
  const count = normalizeCount(restaurantCount);
  if (count <= 5) return COMMISSION_TOTALS_THROUGH_FIVE[count];
  return COMMISSION_TOTALS_THROUGH_FIVE[5] + (count - 5) * COMMISSION_AFTER_FIFTH;
}

export function incrementalCommissionForRestaurant(restaurantNumber: number): number {
  const n = normalizeCount(restaurantNumber);
  if (n <= 0) return 0;
  return commissionTotalForCount(n) - commissionTotalForCount(n - 1);
}

export function calculateRestaurantCommission(restaurantCount: number): RestaurantCommission {
  const count = normalizeCount(restaurantCount);
  const breakdown: CommissionBreakdownRow[] = [];
  for (let n = 1; n <= count; n += 1) {
    breakdown.push({
      restaurantNumber: n,
      label: `${ordinal(n)} Restaurant`,
      amount: incrementalCommissionForRestaurant(n),
    });
  }

  return {
    restaurantCount: count,
    totalCommission: commissionTotalForCount(count),
    currentTier: count === 1 ? '1 Restaurant' : `${count} Restaurants`,
    additionalRestaurantRate: COMMISSION_AFTER_FIFTH,
    nextRestaurantAmount: incrementalCommissionForRestaurant(count + 1),
    rules: [
      { label: '1 Restaurant', totalCommission: 400, additionalRate: null },
      { label: '2 Restaurants', totalCommission: 850, additionalRate: null },
      { label: '3 Restaurants', totalCommission: 1300, additionalRate: null },
      { label: '4 Restaurants', totalCommission: 1800, additionalRate: null },
      { label: '5 Restaurants', totalCommission: 2500, additionalRate: null },
      {
        label: '6+ Restaurants',
        totalCommission: null,
        additionalRate: COMMISSION_AFTER_FIFTH,
      },
    ],
    breakdown,
  };
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
