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
import {
  CreateCouponDto,
  EngagementCustomerQueryDto,
  SendPushNotificationDto,
} from './dto/engagement.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantContext: RestaurantContextService,
    private readonly push: CustomerPushService,
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

  async listCoupons(user: { id: string; role: UserRole; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
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
    return {
      items: rows.map((row) => ({
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
      expiresAt: Date | null;
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
          expiresAt: true,
        },
      });
      if (!coupon) throw new NotFoundException('Coupon not found.');
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
