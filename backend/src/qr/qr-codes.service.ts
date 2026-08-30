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
    if (existing) {
      await this.rewriteTargetUrlIfStale(existing, restaurant.slug);
      return existing;
    }

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

  /** Fix localhost / stale hosts stored before PUBLIC_WEB_URL was set. */
  private async rewriteTargetUrlIfStale<
    T extends { id: string; token: string; targetUrl: string },
  >(qr: T, slug: string): Promise<T> {
    if (!this.qr.needsTargetUrlRewrite(qr.targetUrl, slug, qr.token)) return qr;
    const targetUrl = this.qr.buildTargetUrl(slug, qr.token);
    const updated = await this.prisma.qrCode.update({
      where: { id: qr.id },
      data: { targetUrl },
    });
    return { ...qr, targetUrl: updated.targetUrl };
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
    let rewritten = 0;
    const results = [];
    for (const r of restaurants) {
      const before = await this.prisma.qrCode.findFirst({
        where: { restaurantId: r.id, status: QrCodeStatus.ACTIVE },
      });
      const qr = await this.ensureActiveQr(r.id);
      if (!before) created += 1;
      else if (before.targetUrl !== qr.targetUrl) rewritten += 1;
      results.push({
        restaurantId: r.id,
        name: r.name,
        slug: r.slug,
        qr: this.qr.toPublicQr(qr, r.slug),
      });
    }

    return { created, rewritten, total: results.length, restaurants: results };
  }

  async listAdmin() {
    const restaurants = await this.prisma.restaurant.findMany({
      where: {
        deletedAt: null,
        NOT: { status: RestaurantStatus.ARCHIVED },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        qrCodes: {
          where: { status: QrCodeStatus.ACTIVE },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const out = [];
    for (const r of restaurants) {
      let qr = r.qrCodes[0] || null;
      if (qr) {
        qr = await this.rewriteTargetUrlIfStale(qr, r.slug);
      }
      out.push({
        restaurantId: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status.toLowerCase(),
        qr: qr ? this.qr.toPublicQr(qr, r.slug) : null,
      });
    }
    return out;
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
      qr: this.qr.toPublicQr(qr, restaurant.slug),
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
      qr: this.qr.toPublicQr(qr, ctx.restaurantSlug),
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

    const qr = await this.prisma.$transaction(
      async (tx) => {
        await tx.qrCode.updateMany({
          where: { restaurantId, status: QrCodeStatus.ACTIVE },
          data: { status: QrCodeStatus.DISABLED },
        });
        return this.qr.createPrimaryInTransaction(tx, restaurant);
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

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
      qr: this.qr.toPublicQr(qr, restaurant.slug),
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
      select: {
        id: true,
        token: true,
        status: true,
        targetUrl: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logoUrl: true,
            coverImageUrl: true,
            city: true,
            state: true,
            address: true,
            phone: true,
            status: true,
            deletedAt: true,
          },
        },
      },
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

    // Read-only public path: never rewrite/update QR rows on scan.
    // Stale targetUrl fixes belong to admin backfill / rewrite scripts.

    const dishes = await this.prisma.dish.findMany({
      where: {
        restaurantId: restaurant.id,
        deletedAt: null,
        isPublished: true,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        imageUrl: true,
        calories: true,
        protein: true,
        carbohydrates: true,
        fat: true,
        ingredients: true,
        allergens: true,
        isVeg: true,
        isVegan: true,
        isJain: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
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
        targetUrl: this.qr.buildTargetUrl(restaurant.slug, qr.token),
      },
    };
  }
}
