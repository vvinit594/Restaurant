import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  QrCodeStatus,
  RestaurantStatus,
} from '@prisma/client';
import { auditLog } from '../common/audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import { QrService } from './qr.service';

@Injectable()
export class QrCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
    private readonly restaurantContext: RestaurantContextService,
  ) {}

  /** Idempotent: create ACTIVE QR only if restaurant has none. Never creates restaurants. */
  async ensureActiveQr(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    const existing = await this.prisma.qrCode.findFirst({
      where: { restaurantId, status: QrCodeStatus.ACTIVE },
    });
    if (existing) return existing;

    const token = this.qr.newToken();
    const created = await this.prisma.qrCode.create({
      data: {
        restaurantId,
        token,
        targetUrl: this.qr.buildTargetUrl(restaurant.slug, token),
        status: QrCodeStatus.ACTIVE,
      },
    });

    auditLog('QR_CREATED', {
      restaurantId,
      qrId: created.id,
      token: created.token,
    });

    return created;
  }

  async backfillMissing() {
    const restaurants = await this.prisma.restaurant.findMany({
      where: {
        deletedAt: null,
        NOT: { status: RestaurantStatus.ARCHIVED },
      },
      select: { id: true, name: true, slug: true },
    });

    let created = 0;
    const results = [];
    for (const r of restaurants) {
      const before = await this.prisma.qrCode.findFirst({
        where: { restaurantId: r.id, status: QrCodeStatus.ACTIVE },
      });
      const qr = await this.ensureActiveQr(r.id);
      if (!before) created += 1;
      results.push({
        restaurantId: r.id,
        name: r.name,
        slug: r.slug,
        qr: this.qr.toPublicQr(qr),
      });
    }

    return { created, total: results.length, restaurants: results };
  }

  async listAdmin() {
    const restaurants = await this.prisma.restaurant.findMany({
      where: {
        deletedAt: null,
        NOT: { status: RestaurantStatus.ARCHIVED },
      },
      orderBy: { name: 'asc' },
      include: {
        qrCodes: {
          where: { status: QrCodeStatus.ACTIVE },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return restaurants.map((r) => {
      const qr = r.qrCodes[0] || null;
      return {
        restaurantId: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status.toLowerCase(),
        qr: qr ? this.qr.toPublicQr(qr) : null,
      };
    });
  }

  async getAdminRestaurantQr(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found.');

    const qr = await this.ensureActiveQr(restaurantId);
    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        status: restaurant.status.toLowerCase(),
      },
      qr: this.qr.toPublicQr(qr),
    };
  }

  async regenerateAdmin(restaurantId: string, adminUserId?: string) {
    return this.regenerateForRestaurant(restaurantId, adminUserId);
  }

  async getMyQr(user: { id: string; role: any; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
      MembershipRole.RESTAURANT_MANAGER,
    ]);
    const qr = await this.ensureActiveQr(ctx.restaurantId);
    return {
      restaurant: {
        id: ctx.restaurantId,
        name: ctx.restaurantName,
        slug: ctx.restaurantSlug,
      },
      qr: this.qr.toPublicQr(qr),
    };
  }

  async regenerateMyQr(user: { id: string; role: any; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
      MembershipRole.RESTAURANT_MANAGER,
    ]);
    return this.regenerateForRestaurant(ctx.restaurantId, user.id);
  }

  private async regenerateForRestaurant(
    restaurantId: string,
    actorUserId?: string,
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found.');
    if (restaurant.status === RestaurantStatus.ARCHIVED) {
      throw new ForbiddenException('Cannot regenerate QR for an archived restaurant.');
    }

    const qr = await this.prisma.$transaction(async (tx) => {
      await tx.qrCode.updateMany({
        where: { restaurantId, status: QrCodeStatus.ACTIVE },
        data: { status: QrCodeStatus.DISABLED },
      });
      return this.qr.createPrimaryInTransaction(tx, restaurant);
    });

    auditLog('QR_REGENERATED', {
      restaurantId,
      qrId: qr.id,
      token: qr.token,
      actorUserId: actorUserId || null,
    });

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      qr: this.qr.toPublicQr(qr),
    };
  }

  /**
   * Public QR resolve — token only. Returns public restaurant + menu when valid.
   */
  async resolveByToken(token: string, expectedSlug?: string) {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) throw new NotFoundException('QR code not found.');

    const qr = await this.prisma.qrCode.findUnique({
      where: { token: normalized },
      include: { restaurant: true },
    });

    if (!qr || qr.status !== QrCodeStatus.ACTIVE) {
      throw new NotFoundException('QR code not found.');
    }

    const restaurant = qr.restaurant;
    if (
      restaurant.deletedAt ||
      restaurant.status !== RestaurantStatus.ACTIVE
    ) {
      return {
        available: false,
        message: 'This restaurant is currently unavailable.',
        restaurant: null,
        categories: [] as string[],
        dishes: [] as unknown[],
        qr: { token: qr.token },
      };
    }

    if (expectedSlug && restaurant.slug !== expectedSlug.trim().toLowerCase()) {
      throw new NotFoundException('QR code not found.');
    }

    const dishes = await this.prisma.dish.findMany({
      where: {
        restaurantId: restaurant.id,
        deletedAt: null,
        isPublished: true,
        isAvailable: true,
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const categories = [
      ...new Set(dishes.map((d) => d.category.name).filter(Boolean)),
    ];

    return {
      available: true,
      message: null,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description || '',
        logoUrl: restaurant.logoUrl || '',
        coverUrl: restaurant.coverImageUrl || '',
        city: restaurant.city,
        state: restaurant.state || '',
        address: restaurant.address,
        phone: restaurant.phone,
      },
      categories,
      dishes: dishes.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        description: d.description || '',
        price: Number(d.price),
        category: d.category.name,
        imageUrl: d.imageUrl || '',
        image: d.imageUrl || '',
        calories: d.calories,
        protein: d.protein,
        carbohydrates: d.carbohydrates,
        fat: d.fat,
        ingredients: d.ingredients || [],
        allergens: d.allergens || [],
        isVeg: d.isVeg,
        isVegan: d.isVegan,
        isJain: d.isJain,
      })),
      qr: {
        token: qr.token,
        targetUrl: qr.targetUrl,
      },
    };
  }
}
