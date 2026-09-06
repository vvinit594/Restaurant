import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  RestaurantStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublicOrderDto } from './dto/order.dto';

const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.CANCELLED],
  [OrderStatus.SERVED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

const MAX_LINE_ITEMS = 30;
const MAX_QTY_PER_DISH = 20;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultTables(restaurantId: string) {
    const count = await this.prisma.diningTable.count({
      where: { restaurantId, deletedAt: null },
    });
    if (count > 0) return;

    await this.prisma.diningTable.createMany({
      data: Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        return {
          restaurantId,
          label: String(n),
          code: String(n),
          sortOrder: n,
          isActive: true,
        };
      }),
    });
  }

  async listPublicTables(slug: string) {
    const restaurant = await this.findActiveRestaurantBySlug(slug);
    await this.ensureDefaultTables(restaurant.id);
    const tables = await this.prisma.diningTable.findMany({
      where: {
        restaurantId: restaurant.id,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, code: true, sortOrder: true },
    });
    return {
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
      tables,
    };
  }

  async createPublicOrder(slug: string, dto: CreatePublicOrderDto) {
    const restaurant = await this.findActiveRestaurantBySlug(slug);

    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findFirst({
        where: {
          restaurantId: restaurant.id,
          idempotencyKey: dto.idempotencyKey,
        },
        include: { items: true },
      });
      if (existing) return this.toOrderDto(existing, restaurant.name);
    }

    if (!dto.items?.length) {
      throw new BadRequestException('Add at least one dish to the order.');
    }
    if (dto.items.length > MAX_LINE_ITEMS) {
      throw new BadRequestException('Too many items in one order.');
    }

    const merged = new Map<string, number>();
    for (const line of dto.items) {
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_DISH) {
        throw new BadRequestException(
          `Quantity must be between 1 and ${MAX_QTY_PER_DISH}.`,
        );
      }
      merged.set(line.dishId, (merged.get(line.dishId) || 0) + qty);
    }

    const table = await this.prisma.diningTable.findFirst({
      where: {
        id: dto.tableId,
        restaurantId: restaurant.id,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!table) {
      throw new BadRequestException('Invalid or inactive table for this restaurant.');
    }

    const dishIds = [...merged.keys()];
    const dishes = await this.prisma.dish.findMany({
      where: {
        id: { in: dishIds },
        restaurantId: restaurant.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        price: true,
        isAvailable: true,
        isPublished: true,
      },
    });

    if (dishes.length !== dishIds.length) {
      throw new BadRequestException(
        'One or more dishes are invalid for this restaurant.',
      );
    }

    for (const dish of dishes) {
      if (!dish.isAvailable || !dish.isPublished) {
        throw new BadRequestException(
          `"${dish.name}" is currently unavailable.`,
        );
      }
    }

    const dishById = new Map(dishes.map((d) => [d.id, d]));
    let subtotal = new Prisma.Decimal(0);
    const itemRows = dishIds.map((dishId) => {
      const dish = dishById.get(dishId)!;
      const quantity = merged.get(dishId)!;
      const unit = new Prisma.Decimal(dish.price);
      const itemTotal = unit.mul(quantity);
      subtotal = subtotal.add(itemTotal);
      return {
        dishId: dish.id,
        dishNameSnapshot: dish.name,
        unitPriceSnapshot: unit,
        quantity,
        itemTotal,
      };
    });

    // Extensible billing foundation (tax/discount/service later).
    const taxAmount = new Prisma.Decimal(0);
    const discountAmount = new Prisma.Decimal(0);
    const serviceCharge = new Prisma.Decimal(0);
    const total = subtotal
      .add(taxAmount)
      .add(serviceCharge)
      .sub(discountAmount);

    const orderNumber = await this.nextOrderNumber();

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.create({
            data: {
              orderNumber,
              restaurantId: restaurant.id,
              tableId: table.id,
              tableLabel: table.label,
              status: OrderStatus.NEW,
              subtotal,
              taxAmount,
              discountAmount,
              serviceCharge,
              total,
              notes: dto.notes || null,
              idempotencyKey: dto.idempotencyKey || null,
              items: { create: itemRows },
            },
            include: { items: true },
          });
          return order;
        },
        { maxWait: 10_000, timeout: 20_000 },
      );

      return this.toOrderDto(created, restaurant.name);
    } catch (err: any) {
      if (
        err?.code === 'P2002' &&
        dto.idempotencyKey
      ) {
        const existing = await this.prisma.order.findFirst({
          where: {
            restaurantId: restaurant.id,
            idempotencyKey: dto.idempotencyKey,
          },
          include: { items: true },
        });
        if (existing) return this.toOrderDto(existing, restaurant.name);
      }
      throw err;
    }
  }

  async listRestaurantOrders(
    restaurantId: string,
    query: {
      status?: string;
      active?: string;
      history?: string;
      since?: string;
      take?: number;
    } = {},
  ) {
    const where: Prisma.OrderWhereInput = { restaurantId };

    if (query.active === '1' || query.active === 'true') {
      where.status = { in: ACTIVE_STATUSES };
    } else if (query.history === '1' || query.history === 'true') {
      where.status = {
        in: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      };
    } else if (query.status) {
      const status = String(query.status).toUpperCase() as OrderStatus;
      if (!Object.values(OrderStatus).includes(status)) {
        throw new BadRequestException('Invalid order status filter.');
      }
      where.status = status;
    }

    if (query.since) {
      const since = new Date(query.since);
      if (!Number.isNaN(since.getTime())) {
        where.updatedAt = { gt: since };
      }
    }

    const take = Math.min(Math.max(Number(query.take) || 50, 1), 100);
    const orders = await this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });

    return orders.map((o) => this.toOrderDto(o, restaurant?.name || ''));
  }

  async getRestaurantOrder(restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, address: true, city: true, phone: true },
    });
    return this.toOrderDto(order, restaurant?.name || '', restaurant || undefined);
  }

  async updateStatus(
    restaurantId: string,
    orderId: string,
    nextRaw: string,
  ) {
    const next = String(nextRaw || '').toUpperCase() as OrderStatus;
    if (!Object.values(OrderStatus).includes(next)) {
      throw new BadRequestException('Invalid status.');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const allowed = STATUS_FLOW[order.status] || [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Cannot move order from ${order.status} to ${next}.`,
      );
    }

    // Accept: atomically NEW → ACCEPTED + persist KOT once (no interactive TX / pooler issues).
    if (next === OrderStatus.ACCEPTED) {
      return this.acceptOrderWithKot(restaurantId, order);
    }

    const data: Prisma.OrderUpdateInput = { status: next };
    if (next === OrderStatus.COMPLETED) data.completedAt = new Date();
    if (next === OrderStatus.CANCELLED) data.cancelledAt = new Date();

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data,
      include: { items: true },
    });

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    return this.toOrderDto(updated, restaurant?.name || '');
  }

  /**
   * Accept NEW order and assign a persistent kotNumber exactly once.
   * Concurrent accepts: only one updateMany wins; loser receives the winner's order.
   */
  private async acceptOrderWithKot(
    restaurantId: string,
    order: {
      id: string;
      status: OrderStatus;
      kotNumber: string | null;
      items: any[];
    },
  ) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, address: true, city: true, phone: true },
    });

    if (order.status === OrderStatus.ACCEPTED && order.kotNumber) {
      const fresh = await this.prisma.order.findFirst({
        where: { id: order.id, restaurantId },
        include: { items: true },
      });
      return this.toOrderDto(fresh!, restaurant?.name || '', restaurant || undefined);
    }

    const kotNumber = await this.nextKotNumber();
    const acceptedAt = new Date();
    const result = await this.prisma.order.updateMany({
      where: {
        id: order.id,
        restaurantId,
        status: OrderStatus.NEW,
      },
      data: {
        status: OrderStatus.ACCEPTED,
        acceptedAt,
        kotNumber,
      },
    });

    if (result.count === 0) {
      const latest = await this.prisma.order.findFirst({
        where: { id: order.id, restaurantId },
        include: { items: true },
      });
      if (!latest) throw new NotFoundException('Order not found.');
      if (
        latest.status === OrderStatus.ACCEPTED ||
        latest.status === OrderStatus.PREPARING ||
        latest.status === OrderStatus.READY ||
        latest.status === OrderStatus.SERVED ||
        latest.status === OrderStatus.COMPLETED
      ) {
        // Concurrent accept — ensure kot exists for legacy rows, return same KOT.
        if (!latest.kotNumber) {
          await this.ensureKotNumber(restaurantId, latest.id);
          const withKot = await this.prisma.order.findFirst({
            where: { id: latest.id, restaurantId },
            include: { items: true },
          });
          return this.toOrderDto(
            withKot!,
            restaurant?.name || '',
            restaurant || undefined,
          );
        }
        return this.toOrderDto(latest, restaurant?.name || '', restaurant || undefined);
      }
      throw new ConflictException(
        'Order was already processed and cannot be accepted again.',
      );
    }

    const updated = await this.prisma.order.findFirst({
      where: { id: order.id, restaurantId },
      include: { items: true },
    });
    return this.toOrderDto(updated!, restaurant?.name || '', restaurant || undefined);
  }

  /** KOT payload for download/print — only after acceptance. */
  async getKot(restaurantId: string, orderId: string) {
    let order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (order.status === OrderStatus.NEW) {
      throw new BadRequestException(
        'Accept the order before downloading the KOT.',
      );
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('KOT is not available for cancelled orders.');
    }

    if (!order.kotNumber) {
      await this.ensureKotNumber(restaurantId, order.id);
      order = await this.prisma.order.findFirst({
        where: { id: orderId, restaurantId },
        include: { items: true },
      });
      if (!order?.kotNumber) {
        throw new ConflictException(
          'Order accepted but KOT could not be generated. Retry Download KOT.',
        );
      }
    }

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });

    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const placed = order.placedAt;
    return {
      kotNumber: order.kotNumber,
      orderNumber: order.orderNumber,
      restaurantName: restaurant?.name || '',
      tableNumber: order.tableLabel,
      status: order.status,
      notes: order.notes || '',
      placedAt: placed.toISOString(),
      acceptedAt: order.acceptedAt?.toISOString() || null,
      dateLabel: placed.toLocaleDateString('en-IN'),
      timeLabel: placed.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      items: order.items.map((i) => ({
        quantity: i.quantity,
        name: i.dishNameSnapshot,
      })),
      totalQty,
    };
  }

  private async ensureKotNumber(restaurantId: string, orderId: string) {
    const kotNumber = await this.nextKotNumber();
    await this.prisma.order.updateMany({
      where: { id: orderId, restaurantId, kotNumber: null },
      data: { kotNumber },
    });
  }

  async getOrderStats(restaurantId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      newOrders,
      preparing,
      ready,
      todaysOrders,
      todaysRevenueAgg,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { restaurantId, status: OrderStatus.NEW },
      }),
      this.prisma.order.count({
        where: { restaurantId, status: OrderStatus.PREPARING },
      }),
      this.prisma.order.count({
        where: { restaurantId, status: OrderStatus.READY },
      }),
      this.prisma.order.count({
        where: {
          restaurantId,
          createdAt: { gte: startOfDay },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          restaurantId,
          createdAt: { gte: startOfDay },
          status: {
            in: [
              OrderStatus.COMPLETED,
              OrderStatus.SERVED,
              OrderStatus.READY,
              OrderStatus.PREPARING,
              OrderStatus.ACCEPTED,
              OrderStatus.NEW,
            ],
          },
        },
        _sum: { total: true },
      }),
    ]);

    return {
      newOrders,
      preparing,
      ready,
      todaysOrders,
      todaysRevenue: Number(todaysRevenueAgg._sum.total || 0),
    };
  }

  private async findActiveRestaurantBySlug(slug: string) {
    const normalized = String(slug || '').trim().toLowerCase();
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        slug: normalized,
        status: RestaurantStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, name: true, slug: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }
    return restaurant;
  }

  private async nextOrderNumber() {
    for (let i = 0; i < 5; i += 1) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `DY${suffix}${Date.now().toString().slice(-4)}`;
      const clash = await this.prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true },
      });
      if (!clash) return orderNumber;
    }
    throw new ConflictException('Could not allocate order number. Retry.');
  }

  private async nextKotNumber() {
    for (let i = 0; i < 8; i += 1) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const kotNumber = `DY${suffix}${Date.now().toString().slice(-4)}`;
      const [byKot, byOrder] = await Promise.all([
        this.prisma.order.findUnique({
          where: { kotNumber },
          select: { id: true },
        }),
        this.prisma.order.findUnique({
          where: { orderNumber: kotNumber },
          select: { id: true },
        }),
      ]);
      if (!byKot && !byOrder) return kotNumber;
    }
    throw new ConflictException('Could not allocate KOT number. Retry.');
  }

  private toOrderDto(
    order: {
      id: string;
      orderNumber: string;
      kotNumber?: string | null;
      restaurantId: string;
      tableId: string;
      tableLabel: string;
      status: OrderStatus;
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      serviceCharge: Prisma.Decimal;
      total: Prisma.Decimal;
      notes: string | null;
      placedAt: Date;
      acceptedAt: Date | null;
      completedAt: Date | null;
      cancelledAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      items: Array<{
        id: string;
        dishId: string | null;
        dishNameSnapshot: string;
        unitPriceSnapshot: Prisma.Decimal;
        quantity: number;
        itemTotal: Prisma.Decimal;
      }>;
    },
    restaurantName: string,
    restaurantDetails?: {
      address?: string;
      city?: string;
      phone?: string;
    },
  ) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      kotNumber: order.kotNumber || null,
      restaurantId: order.restaurantId,
      restaurantName,
      restaurantAddress: restaurantDetails?.address || '',
      restaurantCity: restaurantDetails?.city || '',
      restaurantPhone: restaurantDetails?.phone || '',
      tableId: order.tableId,
      tableNumber: order.tableLabel,
      tableLabel: order.tableLabel,
      status: order.status,
      subtotal: Number(order.subtotal),
      taxAmount: Number(order.taxAmount),
      discountAmount: Number(order.discountAmount),
      serviceCharge: Number(order.serviceCharge),
      total: Number(order.total),
      notes: order.notes || '',
      placedAt: order.placedAt.toISOString(),
      acceptedAt: order.acceptedAt?.toISOString() || null,
      completedAt: order.completedAt?.toISOString() || null,
      cancelledAt: order.cancelledAt?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((i) => ({
        id: i.id,
        dishId: i.dishId,
        name: i.dishNameSnapshot,
        dishNameSnapshot: i.dishNameSnapshot,
        unitPrice: Number(i.unitPriceSnapshot),
        unitPriceSnapshot: Number(i.unitPriceSnapshot),
        quantity: i.quantity,
        itemTotal: Number(i.itemTotal),
      })),
      bill: {
        restaurantName,
        orderNumber: order.orderNumber,
        tableNumber: order.tableLabel,
        placedAt: order.placedAt.toISOString(),
        lines: order.items.map((i) => ({
          name: i.dishNameSnapshot,
          quantity: i.quantity,
          unitPrice: Number(i.unitPriceSnapshot),
          lineTotal: Number(i.itemTotal),
        })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        discountAmount: Number(order.discountAmount),
        serviceCharge: Number(order.serviceCharge),
        total: Number(order.total),
      },
    };
  }
}
