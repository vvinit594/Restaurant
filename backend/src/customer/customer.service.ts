import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerCouponStatus,
  CustomerNotificationType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CustomerDeviceIdentity } from './customer-device.service';
import {
  CustomerListQueryDto,
  UpdateCustomerProfileDto,
} from './dto/customer.dto';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(identity: CustomerDeviceIdentity) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: identity.customerId },
      select: {
        displayName: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: { select: { orders: true, restaurants: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found.');

    const unreadCount = await this.prisma.customerNotification.count({
      where: { customerId: identity.customerId, readAt: null },
    });

    return {
      displayName: customer.displayName,
      phone: customer.phone,
      email: customer.email,
      memberSince: customer.createdAt.toISOString(),
      orderCount: customer._count.orders,
      restaurantCount: customer._count.restaurants,
      unreadNotificationCount: unreadCount,
      hasProfileDetails: Boolean(
        customer.displayName || customer.phone || customer.email,
      ),
    };
  }

  async updateProfile(
    identity: CustomerDeviceIdentity,
    dto: UpdateCustomerProfileDto,
  ) {
    await this.prisma.customer.update({
      where: { id: identity.customerId },
      data: {
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName.slice(0, 80) }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.slice(0, 20) } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
      },
    });
    return this.getProfile(identity);
  }

  async listOrders(
    identity: CustomerDeviceIdentity,
    query: CustomerListQueryDto,
    liveOnly = false,
  ) {
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const where: Prisma.OrderWhereInput = {
      customerId: identity.customerId,
      ...(liveOnly ? { status: { in: ACTIVE_ORDER_STATUSES } } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          subtotal: true,
          discountAmount: true,
          total: true,
          placedAt: true,
          acceptedAt: true,
          completedAt: true,
          cancelledAt: true,
          tableLabel: true,
          restaurant: { select: { id: true, name: true, slug: true } },
          items: {
            select: {
              id: true,
              dishNameSnapshot: true,
              quantity: true,
              itemTotal: true,
              unitPriceSnapshot: true,
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
      items: rows.map((order) => this.toCustomerOrder(order)),
    };
  }

  async getOrder(identity: CustomerDeviceIdentity, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: identity.customerId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        serviceCharge: true,
        total: true,
        notes: true,
        placedAt: true,
        acceptedAt: true,
        completedAt: true,
        cancelledAt: true,
        tableLabel: true,
        restaurant: { select: { id: true, name: true, slug: true } },
        items: {
          select: {
            id: true,
            dishNameSnapshot: true,
            quantity: true,
            itemTotal: true,
            unitPriceSnapshot: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return this.toCustomerOrder(order, true);
  }

  async listTransactions(
    identity: CustomerDeviceIdentity,
    query: CustomerListQueryDto,
  ) {
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const where: Prisma.OrderWhereInput = { customerId: identity.customerId };

    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          placedAt: true,
          restaurant: { select: { name: true, slug: true } },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items: rows.map((order) => ({
        id: order.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        restaurantName: order.restaurant.name,
        restaurantSlug: order.restaurant.slug,
        amount: Number(order.total),
        paymentStatus: paymentLabel(order.status),
        date: order.placedAt.toISOString(),
      })),
    };
  }

  async listCoupons(
    identity: CustomerDeviceIdentity,
    query: CustomerListQueryDto,
  ) {
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const now = new Date();

    await this.prisma.customerCoupon.updateMany({
      where: {
        customerId: identity.customerId,
        status: CustomerCouponStatus.AVAILABLE,
        coupon: { expiresAt: { lt: now } },
      },
      data: { status: CustomerCouponStatus.EXPIRED },
    });

    const [total, rows] = await Promise.all([
      this.prisma.customerCoupon.count({
        where: { customerId: identity.customerId },
      }),
      this.prisma.customerCoupon.findMany({
        where: { customerId: identity.customerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          usedAt: true,
          createdAt: true,
          coupon: {
            select: {
              id: true,
              title: true,
              description: true,
              discountType: true,
              discountValue: true,
              code: true,
              minimumOrderValue: true,
              maximumDiscount: true,
              expiresAt: true,
              restaurant: { select: { name: true, slug: true } },
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
        id: row.id,
        status: row.status,
        usedAt: row.usedAt?.toISOString() || null,
        title: row.coupon.title,
        description: row.coupon.description,
        discountType: row.coupon.discountType,
        discountValue: Number(row.coupon.discountValue),
        code: row.coupon.code,
        minimumOrderValue: row.coupon.minimumOrderValue
          ? Number(row.coupon.minimumOrderValue)
          : null,
        maximumDiscount: row.coupon.maximumDiscount
          ? Number(row.coupon.maximumDiscount)
          : null,
        expiresAt: row.coupon.expiresAt?.toISOString() || null,
        restaurantName: row.coupon.restaurant.name,
        restaurantSlug: row.coupon.restaurant.slug,
      })),
    };
  }

  async listNotifications(
    identity: CustomerDeviceIdentity,
    query: CustomerListQueryDto,
  ) {
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const filter = String(query.filter || 'all');
    const where: Prisma.CustomerNotificationWhereInput = {
      customerId: identity.customerId,
    };
    if (filter === 'unread') where.readAt = null;
    if (filter === 'read') where.readAt = { not: null };

    const [total, unreadCount, rows] = await Promise.all([
      this.prisma.customerNotification.count({ where }),
      this.prisma.customerNotification.count({
        where: { customerId: identity.customerId, readAt: null },
      }),
      this.prisma.customerNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          readAt: true,
          createdAt: true,
          orderId: true,
          couponId: true,
          restaurant: { select: { name: true, slug: true } },
          coupon: {
            select: {
              code: true,
              title: true,
              description: true,
              discountType: true,
              discountValue: true,
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
      unreadCount,
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        read: Boolean(row.readAt),
        createdAt: row.createdAt.toISOString(),
        orderId: row.orderId,
        couponId: row.couponId,
        coupon: row.coupon
          ? {
              code: row.coupon.code,
              title: row.coupon.title,
              description: row.coupon.description,
              discountType: row.coupon.discountType,
              discountValue: Number(row.coupon.discountValue),
            }
          : null,
        restaurantName: row.restaurant?.name || 'DilYum',
        restaurantSlug: row.restaurant?.slug || null,
      })),
    };
  }

  async unreadCount(identity: CustomerDeviceIdentity) {
    const unreadCount = await this.prisma.customerNotification.count({
      where: { customerId: identity.customerId, readAt: null },
    });
    return { unreadCount };
  }

  async markRead(identity: CustomerDeviceIdentity, notificationId: string) {
    const updated = await this.prisma.customerNotification.updateMany({
      where: {
        id: notificationId,
        customerId: identity.customerId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.customerNotification.findFirst({
        where: { id: notificationId, customerId: identity.customerId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found.');
    }
    return this.unreadCount(identity);
  }

  async markAllRead(identity: CustomerDeviceIdentity) {
    await this.prisma.customerNotification.updateMany({
      where: { customerId: identity.customerId, readAt: null },
      data: { readAt: new Date() },
    });
    return { unreadCount: 0 };
  }

  async recordVisit(identity: CustomerDeviceIdentity, slug: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!restaurant) return { ok: true };

    await this.prisma.restaurantCustomer.upsert({
      where: {
        restaurantId_customerId: {
          restaurantId: restaurant.id,
          customerId: identity.customerId,
        },
      },
      create: {
        restaurantId: restaurant.id,
        customerId: identity.customerId,
        lastSeenAt: new Date(),
      },
      update: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  async recordOrder(
    identity: CustomerDeviceIdentity,
    restaurantId: string,
  ) {
    const now = new Date();
    await this.prisma.restaurantCustomer.upsert({
      where: {
        restaurantId_customerId: {
          restaurantId,
          customerId: identity.customerId,
        },
      },
      create: {
        restaurantId,
        customerId: identity.customerId,
        lastSeenAt: now,
        lastOrderedAt: now,
        orderCount: 1,
      },
      update: {
        lastSeenAt: now,
        lastOrderedAt: now,
        orderCount: { increment: 1 },
      },
    });
  }

  private toCustomerOrder(
    order: {
      id: string;
      orderNumber: string;
      status: OrderStatus;
      subtotal: Prisma.Decimal;
      taxAmount?: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      serviceCharge?: Prisma.Decimal;
      total: Prisma.Decimal;
      notes?: string | null;
      placedAt: Date;
      acceptedAt: Date | null;
      completedAt: Date | null;
      cancelledAt: Date | null;
      tableLabel: string;
      restaurant: { id?: string; name: string; slug: string };
      items: Array<{
        id: string;
        dishNameSnapshot: string;
        quantity: number;
        itemTotal: Prisma.Decimal;
        unitPriceSnapshot: Prisma.Decimal;
      }>;
    },
    detailed = false,
  ) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      restaurantName: order.restaurant.name,
      restaurantSlug: order.restaurant.slug,
      status: order.status,
      statusLabel: statusLabel(order.status),
      tableLabel: order.tableLabel,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      paymentStatus: paymentLabel(order.status),
      placedAt: order.placedAt.toISOString(),
      acceptedAt: order.acceptedAt?.toISOString() || null,
      completedAt: order.completedAt?.toISOString() || null,
      cancelledAt: order.cancelledAt?.toISOString() || null,
      notes: detailed ? order.notes || '' : undefined,
      taxAmount: detailed ? Number(order.taxAmount || 0) : undefined,
      serviceCharge: detailed ? Number(order.serviceCharge || 0) : undefined,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.dishNameSnapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unitPriceSnapshot),
        itemTotal: Number(item.itemTotal),
      })),
      timeline: [
        { key: OrderStatus.NEW, label: 'Order placed', done: true },
        {
          key: OrderStatus.ACCEPTED,
          label: 'Confirmed',
          done: reached(order.status, OrderStatus.ACCEPTED),
        },
        {
          key: OrderStatus.PREPARING,
          label: 'Preparing',
          done: reached(order.status, OrderStatus.PREPARING),
        },
        {
          key: OrderStatus.READY,
          label: 'Ready',
          done: reached(order.status, OrderStatus.READY),
        },
        {
          key: OrderStatus.SERVED,
          label: 'Served',
          done: reached(order.status, OrderStatus.SERVED),
        },
        {
          key: OrderStatus.COMPLETED,
          label: 'Completed',
          done: order.status === OrderStatus.COMPLETED,
        },
      ],
      cancelled: order.status === OrderStatus.CANCELLED,
    };
  }
}

const STATUS_RANK: Record<OrderStatus, number> = {
  [OrderStatus.NEW]: 0,
  [OrderStatus.ACCEPTED]: 1,
  [OrderStatus.PREPARING]: 2,
  [OrderStatus.READY]: 3,
  [OrderStatus.SERVED]: 4,
  [OrderStatus.COMPLETED]: 5,
  [OrderStatus.CANCELLED]: -1,
};

function reached(current: OrderStatus, target: OrderStatus) {
  if (current === OrderStatus.CANCELLED) return false;
  return STATUS_RANK[current] >= STATUS_RANK[target];
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case OrderStatus.NEW:
      return 'Order placed';
    case OrderStatus.ACCEPTED:
      return 'Confirmed';
    case OrderStatus.PREPARING:
      return 'Preparing';
    case OrderStatus.READY:
      return 'Ready';
    case OrderStatus.SERVED:
      return 'Served';
    case OrderStatus.COMPLETED:
      return 'Completed';
    case OrderStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}

function paymentLabel(status: OrderStatus) {
  if (status === OrderStatus.CANCELLED) return 'Cancelled';
  if (status === OrderStatus.COMPLETED || status === OrderStatus.SERVED) {
    return 'Paid at restaurant';
  }
  return 'Due at restaurant';
}

export function orderStatusNotificationCopy(
  status: OrderStatus,
  restaurantName: string,
  orderNumber: string,
) {
  const label = statusLabel(status);
  return {
    type: CustomerNotificationType.ORDER_STATUS,
    title: `Order ${orderNumber}: ${label}`,
    message: `${restaurantName} updated your order ${orderNumber} to ${label}.`,
  };
}
