import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CouponDiscountType,
  CustomerCouponStatus,
  CustomerNotificationType,
  Prisma,
  PushCampaignStatus,
  PushCampaignTargeting,
  UserRole,
} from '@prisma/client';
import { CustomerPushService } from '../customer/customer-push.service';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import { isCouponAttachable } from './coupon-availability';
import { ProgramCouponSync } from './program-coupon.sync';
import {
  CreateCouponDto,
  EngagementCouponQueryDto,
  EngagementCustomerQueryDto,
  SendPushNotificationDto,
  UpdateCouponDto,
} from './dto/engagement.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantContext: RestaurantContextService,
    private readonly push: CustomerPushService,
    private readonly programCoupons: ProgramCouponSync,
  ) {}

  async listCustomers(
    user: { id: string; role: UserRole; restaurantId?: string },
    query: EngagementCustomerQueryDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const search = String(query.search || '').trim();
    const targeting = String(query.targeting || 'ALL');

    const where: Prisma.RestaurantCustomerWhereInput = {
      restaurantId: ctx.restaurantId,
    };
    if (targeting === 'PREVIOUSLY_ORDERED') {
      where.orderCount = { gt: 0 };
    }
    if (search) {
      where.customer = {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.restaurantCustomer.count({ where }),
      this.prisma.restaurantCustomer.findMany({
        where,
        orderBy: [{ lastOrderedAt: 'desc' }, { lastSeenAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          customerId: true,
          firstSeenAt: true,
          lastSeenAt: true,
          lastOrderedAt: true,
          orderCount: true,
          customer: {
            select: {
              displayName: true,
              phone: true,
              email: true,
              devices: {
                select: {
                  _count: { select: { pushSubscriptions: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items: rows.map((row) => ({
        id: row.customerId,
        restaurantCustomerId: row.id,
        displayName: row.customer.displayName || 'Guest diner',
        phone: row.customer.phone,
        email: row.customer.email,
        orderCount: row.orderCount,
        lastOrderedAt: row.lastOrderedAt?.toISOString() || null,
        lastSeenAt: row.lastSeenAt.toISOString(),
        firstSeenAt: row.firstSeenAt.toISOString(),
        pushEnabled: row.customer.devices.some(
          (d) => d._count.pushSubscriptions > 0,
        ),
      })),
    };
  }

  async listCoupons(
    user: { id: string; role: UserRole; restaurantId?: string },
    query: EngagementCouponQueryDto = {},
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    await this.programCoupons.backfillEnabledPrograms(ctx.restaurantId, user.id);
    const rows = await this.prisma.coupon.findMany({
      where: { restaurantId: ctx.restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        code: true,
        minimumOrderValue: true,
        maximumDiscount: true,
        startsAt: true,
        expiresAt: true,
        usageLimit: true,
        usedCount: true,
        isActive: true,
        createdAt: true,
        _count: { select: { grants: true } },
      },
    });
    const visible =
      query.status === 'active'
        ? rows.filter((row) => isCouponAttachable(row))
        : rows;
    return {
      activeCount: rows.filter((row) => row.isActive).length,
      items: visible.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        discountType: row.discountType,
        discountValue: Number(row.discountValue),
        code: row.code,
        minimumOrderValue: row.minimumOrderValue
          ? Number(row.minimumOrderValue)
          : null,
        maximumDiscount: row.maximumDiscount
          ? Number(row.maximumDiscount)
          : null,
        startsAt: row.startsAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() || null,
        usageLimit: row.usageLimit,
        usedCount: row.usedCount,
        isActive: row.isActive,
        grantedCount: row._count.grants,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async createCoupon(
    user: { id: string; role: UserRole; restaurantId?: string },
    dto: CreateCouponDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const code = String(dto.code).trim().toUpperCase();
    const discountType = dto.discountType as CouponDiscountType;
    if (discountType === CouponDiscountType.PERCENT && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100.');
    }

    try {
      const coupon = await this.prisma.coupon.create({
        data: {
          restaurantId: ctx.restaurantId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          discountType,
          discountValue: dto.discountValue,
          code,
          minimumOrderValue: dto.minimumOrderValue ?? null,
          maximumDiscount: dto.maximumDiscount ?? null,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          usageLimit: dto.usageLimit ?? null,
          createdByUserId: user.id,
        },
      });
      return {
        id: coupon.id,
        title: coupon.title,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
      };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException('That coupon code already exists for this restaurant.');
      }
      throw err;
    }
  }

  async updateCoupon(
    user: { id: string; role: UserRole; restaurantId?: string },
    couponId: string,
    dto: UpdateCouponDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const existing = await this.prisma.coupon.findFirst({
      where: { id: couponId, restaurantId: ctx.restaurantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Coupon not found.');

    const discountType = dto.discountType as CouponDiscountType | undefined;
    if (discountType === CouponDiscountType.PERCENT && (dto.discountValue ?? 0) > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100.');
    }
    if (dto.discountValue != null && dto.discountValue > 100) {
      const current = await this.prisma.coupon.findFirst({
        where: { id: existing.id },
        select: { discountType: true },
      });
      const effective = discountType || current?.discountType;
      if (effective === CouponDiscountType.PERCENT) {
        throw new BadRequestException('Percentage discount cannot exceed 100.');
      }
    }

    const data: Prisma.CouponUpdateInput = {};
    if (dto.title != null) data.title = dto.title.trim();
    if (dto.description != null) data.description = dto.description.trim();
    if (discountType) data.discountType = discountType;
    if (dto.discountValue != null) data.discountValue = dto.discountValue;
    if (dto.code != null) data.code = dto.code.trim().toUpperCase();
    if (dto.minimumOrderValue != null) data.minimumOrderValue = dto.minimumOrderValue;
    if (dto.maximumDiscount != null) data.maximumDiscount = dto.maximumDiscount;
    if (dto.startsAt) data.startsAt = new Date(dto.startsAt);
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);
    if (dto.usageLimit != null) data.usageLimit = dto.usageLimit;
    if (dto.isActive != null) data.isActive = dto.isActive;

    try {
      const coupon = await this.prisma.coupon.update({
        where: { id: existing.id },
        data,
      });
      return this.toCouponResponse(coupon);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException('That coupon code already exists for this restaurant.');
      }
      throw err;
    }
  }

  async deleteCoupon(
    user: { id: string; role: UserRole; restaurantId?: string },
    couponId: string,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const existing = await this.prisma.coupon.findFirst({
      where: { id: couponId, restaurantId: ctx.restaurantId },
      select: { id: true, code: true },
    });
    if (!existing) throw new NotFoundException('Coupon not found.');
    await this.prisma.coupon.delete({ where: { id: existing.id } });
    return { id: existing.id, code: existing.code, deleted: true };
  }

  private toCouponResponse(coupon: {
    id: string;
    title: string;
    code: string;
    discountType: CouponDiscountType;
    discountValue: Prisma.Decimal;
    isActive: boolean;
    description?: string | null;
  }) {
    return {
      id: coupon.id,
      title: coupon.title,
      description: coupon.description ?? null,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      isActive: coupon.isActive,
    };
  }

  async listCampaigns(user: { id: string; role: UserRole; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const rows = await this.prisma.pushCampaign.findMany({
      where: { restaurantId: ctx.restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        message: true,
        targeting: true,
        recipientCount: true,
        deliveredCount: true,
        failedCount: true,
        status: true,
        sentAt: true,
        createdAt: true,
        coupon: { select: { code: true, title: true } },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        targeting: row.targeting,
        recipientCount: row.recipientCount,
        deliveredCount: row.deliveredCount,
        failedCount: row.failedCount,
        status: row.status,
        sentAt: row.sentAt?.toISOString() || null,
        createdAt: row.createdAt.toISOString(),
        couponCode: row.coupon?.code || null,
        couponTitle: row.coupon?.title || null,
      })),
    };
  }

  async sendNotification(
    user: { id: string; role: UserRole; restaurantId?: string },
    dto: SendPushNotificationDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const targeting = dto.targeting as PushCampaignTargeting;

    let coupon: {
      id: string;
      title: string;
      code: string;
      description: string | null;
      discountType: CouponDiscountType;
      discountValue: Prisma.Decimal;
      startsAt: Date;
      expiresAt: Date | null;
      isActive: boolean;
      usageLimit: number | null;
      usedCount: number;
    } | null = null;

    if (dto.couponId) {
      coupon = await this.prisma.coupon.findFirst({
        where: { id: dto.couponId, restaurantId: ctx.restaurantId },
        select: {
          id: true,
          title: true,
          code: true,
          description: true,
          discountType: true,
          discountValue: true,
          startsAt: true,
          expiresAt: true,
          isActive: true,
          usageLimit: true,
          usedCount: true,
        },
      });
      if (!coupon) throw new NotFoundException('Coupon not found.');
      if (!isCouponAttachable(coupon)) {
        throw new BadRequestException('Select an active coupon.');
      }
    }

    const customerIds = await this.resolveRecipients(
      ctx.restaurantId,
      targeting,
      dto.customerIds || [],
    );
    if (!customerIds.length) {
      throw new BadRequestException('No eligible customers found for this targeting.');
    }

    const campaign = await this.prisma.pushCampaign.create({
      data: {
        restaurantId: ctx.restaurantId,
        title: dto.title.trim(),
        message: dto.message.trim(),
        targeting,
        couponId: coupon?.id || null,
        recipientCount: customerIds.length,
        status: PushCampaignStatus.PENDING,
        sentByUserId: user.id,
        sentAt: new Date(),
      },
    });

    let delivered = 0;
    let failed = 0;
    const type = coupon
      ? CustomerNotificationType.COUPON
      : CustomerNotificationType.PROMO;

    for (const customerId of customerIds) {
      if (coupon) {
        await this.prisma.customerCoupon.upsert({
          where: {
            couponId_customerId: { couponId: coupon.id, customerId },
          },
          create: {
            couponId: coupon.id,
            customerId,
            status: CustomerCouponStatus.AVAILABLE,
          },
          update: {},
        });
      }

      const notification = await this.prisma.customerNotification.create({
        data: {
          customerId,
          restaurantId: ctx.restaurantId,
          type,
          title: dto.title.trim(),
          message: dto.message.trim(),
          couponId: coupon?.id || null,
          campaignId: campaign.id,
        },
      });

      const pushResult = await this.push.sendToCustomer(customerId, {
        title: dto.title.trim(),
        body: dto.message.trim(),
        url: coupon ? '/account/coupons' : '/account/notifications',
        notificationId: notification.id,
      });
      delivered += pushResult.delivered;
      failed += pushResult.failed;
    }

    const status =
      delivered === 0 && failed > 0
        ? PushCampaignStatus.FAILED
        : failed > 0
          ? PushCampaignStatus.PARTIAL
          : PushCampaignStatus.SENT;

    await this.prisma.pushCampaign.update({
      where: { id: campaign.id },
      data: {
        deliveredCount: delivered,
        failedCount: failed,
        status,
      },
    });

    return {
      id: campaign.id,
      recipientCount: customerIds.length,
      deliveredCount: delivered,
      failedCount: failed,
      status,
    };
  }

  private async resolveRecipients(
    restaurantId: string,
    targeting: PushCampaignTargeting,
    customerIds: string[],
  ) {
    if (targeting === PushCampaignTargeting.INDIVIDUAL) {
      const unique = Array.from(new Set(customerIds.filter(Boolean)));
      if (!unique.length) {
        throw new BadRequestException('Select at least one customer.');
      }
      const allowed = await this.prisma.restaurantCustomer.findMany({
        where: { restaurantId, customerId: { in: unique } },
        select: { customerId: true },
      });
      if (allowed.length !== unique.length) {
        throw new BadRequestException(
          'One or more customers are not associated with this restaurant.',
        );
      }
      return unique;
    }

    const where: Prisma.RestaurantCustomerWhereInput = { restaurantId };
    if (targeting === PushCampaignTargeting.PREVIOUSLY_ORDERED) {
      where.orderCount = { gt: 0 };
    }
    const rows = await this.prisma.restaurantCustomer.findMany({
      where,
      select: { customerId: true },
      take: 500,
    });
    return rows.map((r) => r.customerId);
  }
}
