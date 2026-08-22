import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  Prisma,
  QrCodeStatus,
  RestaurantStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { auditLog } from '../../common/audit-log';
import { PrismaService } from '../../prisma/prisma.service';
import { QrService } from '../../qr/qr.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';

@Injectable()
export class AdminRestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: QrService,
  ) {}

  async list(query: { search?: string; status?: string } = {}) {
    const search = String(query.search || '').trim();
    const statusFilter = String(query.status || 'all').toLowerCase();

    const where: Prisma.RestaurantWhereInput = {
      deletedAt: null,
      NOT: { status: RestaurantStatus.ARCHIVED },
    };

    if (statusFilter && statusFilter !== 'all') {
      const mapped = statusFilter.toUpperCase();
      if (
        mapped === RestaurantStatus.ACTIVE ||
        mapped === RestaurantStatus.SUSPENDED
      ) {
        where.status = mapped;
        delete where.NOT;
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const restaurants = await this.prisma.restaurant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { plan: true },
        },
        memberships: {
          where: { role: MembershipRole.RESTAURANT_OWNER, isActive: true },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    return restaurants.map((r) => this.toAdminListItem(r));
  }

  async create(
    dto: CreateRestaurantDto,
    adminUser: { id: string; email?: string },
  ) {
    const restaurantInput = dto.restaurant;
    const ownerInput = dto.admin || dto.owner;
    const planCode = this.normalizePlanCode(
      dto.subscriptionPlan ||
        dto.subscription?.plan ||
        dto.subscription?.planId ||
        '',
    );

    if (!ownerInput) {
      throw new BadRequestException('Restaurant admin/owner details are required.');
    }
    if (!planCode) {
      throw new BadRequestException('Subscription plan is required.');
    }

    const slug = String(restaurantInput.slug || '')
      .trim()
      .toLowerCase();
    const ownerEmail = String(ownerInput.email || '')
      .trim()
      .toLowerCase();
    const password = String(ownerInput.password || '');

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const existingSlug = await this.prisma.restaurant.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException('A restaurant with this slug already exists.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) {
      throw new BadRequestException('Selected subscription plan was not found.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const coverImageUrl =
      restaurantInput.coverImageUrl || restaurantInput.coverUrl || '';

    const created = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: restaurantInput.name.trim(),
          slug,
          description: restaurantInput.description?.trim() || null,
          logoUrl: restaurantInput.logoUrl?.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
          phone: restaurantInput.phone.trim(),
          email: restaurantInput.email.trim().toLowerCase(),
          address: restaurantInput.address.trim(),
          city: restaurantInput.city.trim(),
          state: restaurantInput.state?.trim() || null,
          pincode: restaurantInput.pincode?.trim() || null,
          status: RestaurantStatus.ACTIVE,
          createdByUserId: adminUser.id,
        },
      });

      const owner = await tx.user.create({
        data: {
          name: ownerInput.name.trim(),
          email: ownerEmail,
          phone: ownerInput.phone?.trim() || null,
          passwordHash,
          role: UserRole.RESTAURANT_OWNER,
          isActive: true,
        },
      });

      await tx.restaurantMembership.create({
        data: {
          userId: owner.id,
          restaurantId: restaurant.id,
          role: MembershipRole.RESTAURANT_OWNER,
          isActive: true,
        },
      });

      await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: plan.id,
          status: 'ACTIVE',
        },
      });

      await tx.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Main Branch',
          isDefault: true,
        },
      });

      const defaultCategories = [
        'South Indian',
        'Starters',
        'Main Course',
        'Rice',
        'Beverages',
        'Desserts',
      ];
      await tx.category.createMany({
        data: defaultCategories.map((name, index) => ({
          restaurantId: restaurant.id,
          name,
          slug: name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
          sortOrder: index + 1,
        })),
      });

      const qr = await this.qrService.createPrimaryInTransaction(tx, restaurant);

      return { restaurant, owner, qr };
    });

    auditLog('RESTAURANT_CREATED', {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email || null,
      restaurantId: created.restaurant.id,
      restaurantSlug: created.restaurant.slug,
      ownerUserId: created.owner.id,
      qrId: created.qr.id,
      qrToken: created.qr.token,
    });

    return {
      message: 'Restaurant created successfully',
      restaurant: {
        id: created.restaurant.id,
        name: created.restaurant.name,
        slug: created.restaurant.slug,
        status: created.restaurant.status,
        createdByUserId: created.restaurant.createdByUserId,
      },
      owner: {
        id: created.owner.id,
        name: created.owner.name,
        email: created.owner.email,
        role: created.owner.role,
      },
      qr: this.qrService.toPublicQr(created.qr),
    };
  }

  async getOne(id: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { plan: true },
        },
        memberships: {
          where: { role: MembershipRole.RESTAURANT_OWNER, isActive: true },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }
    return this.toAdminListItem(restaurant);
  }

  async softDelete(id: string, actor?: { id: string }) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: RestaurantStatus.ARCHIVED,
        },
      });

      await tx.restaurantMembership.updateMany({
        where: { restaurantId: id, isActive: true },
        data: { isActive: false },
      });

      await tx.subscription.updateMany({
        where: { restaurantId: id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });

      // Soft-hide menu so public/menu APIs ignore them if queried later
      await tx.dish.updateMany({
        where: { restaurantId: id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          isPublished: false,
          isAvailable: false,
        },
      });

      await tx.qrCode.updateMany({
        where: { restaurantId: id, status: QrCodeStatus.ACTIVE },
        data: { status: QrCodeStatus.DISABLED },
      });
    });

    auditLog('RESTAURANT_DELETED', {
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
      adminUserId: actor?.id || null,
    });

    return {
      message: 'Restaurant deleted successfully',
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        status: RestaurantStatus.ARCHIVED,
      },
    };
  }

  async setStatus(
    id: string,
    status: RestaurantStatus,
    actor?: { id: string },
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }
    const updated = await this.prisma.restaurant.update({
      where: { id },
      data: { status },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { plan: true },
        },
        memberships: {
          where: { role: MembershipRole.RESTAURANT_OWNER, isActive: true },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    auditLog(
      status === RestaurantStatus.SUSPENDED
        ? 'RESTAURANT_SUSPENDED'
        : 'RESTAURANT_ACTIVATED',
      {
        restaurantId: updated.id,
        restaurantSlug: updated.slug,
        status: updated.status,
        adminUserId: actor?.id || null,
      },
    );

    return this.toAdminListItem(updated);
  }

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((p) => ({
      id: p.code.toLowerCase(),
      code: p.code,
      name: p.name,
      priceLabel: p.priceLabel,
      features: Array.isArray(p.features) ? p.features : [],
    }));
  }

  private normalizePlanCode(raw: string) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '');
  }

  private toAdminListItem(r: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string | null;
    pincode: string | null;
    status: RestaurantStatus;
    createdAt: Date;
    updatedAt: Date;
    subscriptions: Array<{
      plan: { code: string; name: string; priceLabel: string };
    }>;
    memberships: Array<{
      user: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        role: UserRole;
        isActive: boolean;
      };
    }>;
  }) {
    const plan = r.subscriptions[0]?.plan;
    const owner = r.memberships[0]?.user;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description || '',
      logoUrl: r.logoUrl || '',
      coverUrl: r.coverImageUrl || '',
      phone: r.phone,
      email: r.email,
      address: r.address,
      city: r.city,
      state: r.state || '',
      pincode: r.pincode || '',
      status: r.status.toLowerCase(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      subscriptionPlanId: plan?.code.toLowerCase() || null,
      subscriptionPlan: plan
        ? {
            id: plan.code.toLowerCase(),
            name: plan.name,
            priceLabel: plan.priceLabel,
          }
        : null,
      admin: owner
        ? {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone || '',
            status: owner.isActive ? 'active' : 'inactive',
            role: owner.role,
          }
        : null,
      stats: {
        categories: 0,
        dishes: 0,
        publishedDishes: 0,
        unavailableDishes: 0,
        tables: 0,
        activeQrCodes: 0,
        revokedQrCodes: 0,
      },
    };
  }
}
