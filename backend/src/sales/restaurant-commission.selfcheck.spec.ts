import { BadRequestException } from '@nestjs/common';
import {
  calculateRestaurantCommission,
  commissionTotalForCount,
  incrementalCommissionForRestaurant,
} from './restaurant-commission';
import { normalizeUpiId } from './upi-id';

describe('restaurant commission totals', () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [1, 400],
    [2, 850],
    [3, 1300],
    [4, 1800],
    [5, 2500],
    [6, 3000],
    [7, 3500],
    [8, 4000],
    [9, 4500],
    [10, 5000],
  ];

  it.each(cases)('%s restaurants → ₹%s', (count, total) => {
    expect(commissionTotalForCount(count)).toBe(total);
    expect(calculateRestaurantCommission(count).totalCommission).toBe(total);
  });

  it('uses incremental amounts that sum to the cumulative total', () => {
    const result = calculateRestaurantCommission(7);
    expect(result.breakdown.map((row) => row.amount)).toEqual([
      400, 450, 450, 500, 700, 500, 500,
    ]);
    const sum = result.breakdown.reduce((n, row) => n + row.amount, 0);
    expect(sum).toBe(3500);
    expect(result.totalCommission).toBe(3500);
    expect(incrementalCommissionForRestaurant(6)).toBe(500);
    expect(calculateRestaurantCommission(0).breakdown).toEqual([]);
  });

  it('does not multiply the 5-restaurant total by the count', () => {
    expect(commissionTotalForCount(5)).toBe(2500);
    expect(commissionTotalForCount(5)).not.toBe(2500 * 5);
  });
});

describe('UPI ID', () => {
  it('allows empty and trims a valid id', () => {
    expect(normalizeUpiId('')).toBeNull();
    expect(normalizeUpiId('   ')).toBeNull();
    expect(normalizeUpiId(null)).toBeNull();
    expect(normalizeUpiId('  vinit@upi  ')).toBe('vinit@upi');
    expect(normalizeUpiId('adarsh.dinesh@okaxis')).toBe('adarsh.dinesh@okaxis');
  });

  it('rejects spaces and malformed values', () => {
    expect(() => normalizeUpiId('vinit @upi')).toThrow(BadRequestException);
    expect(() => normalizeUpiId('not-a-upi')).toThrow(BadRequestException);
    expect(() => normalizeUpiId('@upi')).toThrow(BadRequestException);
    expect(() => normalizeUpiId('name@')).toThrow(BadRequestException);
  });
});
