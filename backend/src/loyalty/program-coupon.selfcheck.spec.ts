import { loyaltyProgramCoupon } from './program-coupon';

describe('loyalty program coupons eligible for the notification dropdown', () => {
  const programs = [
    {
      programType: 'BIRTHDAY_REWARD',
      enabled: true,
      configuration: { couponCode: 'BDAY20', discountPercent: 20, validityDays: 30 },
    },
    {
      programType: 'EXCLUSIVE_OFFERS',
      enabled: true,
      configuration: { couponCode: 'SPECIAL50', discountPercent: 50, minimumOrderValue: 500 },
    },
    {
      programType: 'CASHBACK',
      enabled: false,
      configuration: { couponCode: 'FESTIVE10', discountPercent: 10 },
    },
    {
      programType: 'STAMP_CARD',
      enabled: true,
      configuration: { stampsRequired: 9, rewardType: 'FREE_ITEM', rewardDescription: '1 free item' },
    },
  ];

  it('includes every enabled program that has a saved coupon code and discount', () => {
    const codes = programs
      .filter((program) => program.enabled)
      .map((program) => loyaltyProgramCoupon(program)?.code)
      .filter(Boolean);
    expect(codes).toEqual(['BDAY20', 'SPECIAL50']);
  });

  it('leaves disabled and non-coupon programs out', () => {
    const festive = programs.find((program) => program.configuration.couponCode === 'FESTIVE10');
    const stamp = programs.find((program) => program.programType === 'STAMP_CARD');
    expect(loyaltyProgramCoupon(festive!).code).toBe('FESTIVE10');
    expect(festive!.enabled).toBe(false);
    expect(loyaltyProgramCoupon(stamp!)).toBeNull();
  });

  it('rejects an incomplete coupon configuration', () => {
    expect(
      loyaltyProgramCoupon({
        programType: 'BIRTHDAY_REWARD',
        configuration: { couponCode: 'BDAY20' },
      }),
    ).toBeNull();
    expect(
      loyaltyProgramCoupon({
        programType: 'EXCLUSIVE_OFFERS',
        configuration: { discountPercent: 20, minimumOrderValue: 500 },
      }),
    ).toBeNull();
  });
});
