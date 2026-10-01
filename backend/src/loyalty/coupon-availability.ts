export type CouponAvailabilityInput = {
  isActive: boolean;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  usageLimit?: number | null;
  usedCount?: number | null;
};

export function isCouponAttachable(
  coupon: CouponAvailabilityInput,
  now: Date = new Date(),
) {
  if (!coupon.isActive) return false;
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) {
    return false;
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now.getTime()) {
    return false;
  }
  if (
    coupon.usageLimit != null &&
    Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)
  ) {
    return false;
  }
  return true;
}
