import { isCouponAttachable } from './coupon-availability';

describe('coupon availability', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');

  it('allows several active coupons at once', () => {
    const coupons = [
      { isActive: true, code: 'WELCOME20' },
      { isActive: true, code: 'FESTIVE15' },
      { isActive: false, code: 'SAVE100' },
      { isActive: true, code: 'DESSERT' },
    ];
    expect(coupons.filter((coupon) => isCouponAttachable(coupon, now)).map((c) => c.code)).toEqual([
      'WELCOME20',
      'FESTIVE15',
      'DESSERT',
    ]);
  });

  it('excludes expired and used-up coupons without affecting others', () => {
    expect(
      isCouponAttachable(
        { isActive: true, expiresAt: '2026-09-01T00:00:00.000Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isCouponAttachable({ isActive: true, usageLimit: 1, usedCount: 1 }, now),
    ).toBe(false);
    expect(isCouponAttachable({ isActive: true, usageLimit: 2, usedCount: 1 }, now)).toBe(
      true,
    );
  });
});
