import { Injectable } from '@nestjs/common';
import { CouponDiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loyaltyProgramCoupon, readLinkedCouponId } from './program-coupon';

@Injectable()
export class ProgramCouponSync {
  constructor(private readonly prisma: PrismaService) {}

  async syncProgram(
    restaurantId: string,
    program: { programType: string; enabled: boolean; configuration: unknown },
    userId?: string,
  ): Promise<Prisma.InputJsonValue> {
    const configuration = { ...(this.asConfig(program.configuration) || {}) };
    const spec = loyaltyProgramCoupon({
      programType: program.programType,
      configuration,
    });
    const linkedCouponId = readLinkedCouponId(configuration);

    if (!spec) return configuration as Prisma.InputJsonValue;

    if (!program.enabled) {
      if (linkedCouponId) {
        await this.prisma.coupon.updateMany({
          where: { id: linkedCouponId, restaurantId },
          data: { isActive: false },
        });
      }
      return configuration as Prisma.InputJsonValue;
    }

    if (linkedCouponId) {
      const linked = await this.prisma.coupon.findFirst({
        where: { id: linkedCouponId, restaurantId },
        select: { id: true, code: true },
      });
      if (linked && linked.code !== spec.code) {
        await this.prisma.coupon.update({
          where: { id: linked.id },
          data: { isActive: false },
        });
      }
    }

    const coupon = await this.upsertCoupon(restaurantId, spec, userId);
    configuration.linkedCouponId = coupon.id;
    return configuration as Prisma.InputJsonValue;
  }

  async backfillEnabledPrograms(restaurantId: string, userId?: string) {
    const programs = await this.prisma.restaurantLoyaltyProgram.findMany({
      where: { restaurantId, enabled: true },
    });

    for (const program of programs) {
      const spec = loyaltyProgramCoupon(program);
      if (!spec) continue;
      const linked = readLinkedCouponId(program.configuration);
      const existing = await this.prisma.coupon.findFirst({
        where: { restaurantId, code: spec.code },
        select: { id: true },
      });
      if (existing) {
        if (!linked) {
          await this.prisma.restaurantLoyaltyProgram.update({
            where: { id: program.id },
            data: {
              configuration: {
                ...(this.asConfig(program.configuration) || {}),
                linkedCouponId: existing.id,
              } as Prisma.InputJsonValue,
            },
          });
        }
        continue;
      }
      if (linked) continue;

      const created = await this.upsertCoupon(restaurantId, spec, userId);
      await this.prisma.restaurantLoyaltyProgram.update({
        where: { id: program.id },
        data: {
          configuration: {
            ...(this.asConfig(program.configuration) || {}),
            linkedCouponId: created.id,
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async upsertCoupon(
    restaurantId: string,
    spec: NonNullable<ReturnType<typeof loyaltyProgramCoupon>>,
    userId?: string,
  ) {
    const data = {
      title: spec.title,
      description: spec.description,
      discountType: spec.discountType as CouponDiscountType,
      discountValue: spec.discountValue,
      minimumOrderValue: spec.minimumOrderValue,
      maximumDiscount: spec.maximumDiscount,
      isActive: true,
    };
    const existing = await this.prisma.coupon.findFirst({
      where: { restaurantId, code: spec.code },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.coupon.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.coupon.create({
      data: {
        restaurantId,
        code: spec.code,
        createdByUserId: userId || null,
        ...data,
      },
    });
  }

  private asConfig(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return { ...(value as Record<string, unknown>) };
  }
}
