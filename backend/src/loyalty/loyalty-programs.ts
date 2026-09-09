import { LoyaltyProgramType } from '@prisma/client';

export const LOYALTY_PROGRAM_DEFINITIONS: Record<
  LoyaltyProgramType,
  {
    title: string;
    summary: string;
    defaultConfiguration: Record<string, unknown>;
  }
> = {
  POINTS: {
    title: 'Points System',
    summary: 'Points per Rs 1: 1 · 500 pts = Rs OFF: 500 · 1000 pts = Rs OFF: 1000',
    defaultConfiguration: {
      pointsPerRupee: 1,
      redemptionPoints: 500,
      redemptionValue: 500,
    },
  },
  STAMP_CARD: {
    title: 'Stamp Card',
    summary: 'Stamps needed: 9 · Reward: 1 free item',
    defaultConfiguration: {
      stampsRequired: 9,
      rewardType: 'FREE_ITEM',
      rewardDescription: '1 free item',
    },
  },
  MEMBERSHIP_TIERS: {
    title: 'Membership Tiers',
    summary: 'Bronze % OFF: 5 · Silver % OFF: 10 · Gold % OFF: 15',
    defaultConfiguration: {
      bronzeThreshold: 5,
      bronzeDiscount: 5,
      silverThreshold: 10,
      silverDiscount: 10,
      goldThreshold: 15,
      goldDiscount: 15,
    },
  },
  BIRTHDAY_REWARD: {
    title: 'Birthday Reward',
    summary: 'Discount %: 20 · Coupon Code: BDAY20',
    defaultConfiguration: {
      discountPercent: 20,
      couponCode: 'BDAY20',
      validityDays: 30,
    },
  },
  REFER_EARN: {
    title: 'Refer & Earn',
    summary: 'Referrer Rs OFF: 100 · Friend Rs OFF: 100',
    defaultConfiguration: {
      referrerReward: 100,
      friendReward: 100,
    },
  },
  CASHBACK: {
    title: 'Cashback Rewards',
    summary: 'Cashback %: 5 · Max Cashback Rs: 100',
    defaultConfiguration: {
      cashbackPercent: 5,
      maxCashback: 100,
    },
  },
  EXCLUSIVE_OFFERS: {
    title: 'Exclusive Offers',
    summary: 'Flat % OFF: 20 · Min Order Rs: 500',
    defaultConfiguration: {
      discountPercent: 20,
      minimumOrderValue: 500,
    },
  },
  ORDER_STREAK: {
    title: 'Order Streak',
    summary: 'Consecutive days: 5 · Reward: 1 free item',
    defaultConfiguration: {
      consecutiveDays: 5,
      rewardDescription: '1 free item',
    },
  },
};

export function loyaltyProgramList() {
  return Object.entries(LOYALTY_PROGRAM_DEFINITIONS).map(([programType, meta]) => ({
    programType: programType as LoyaltyProgramType,
    ...meta,
  }));
}
