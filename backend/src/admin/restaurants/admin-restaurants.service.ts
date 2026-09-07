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
  SalesLeadStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { auditLog } from '../../common/audit-log';
import { PrismaService } from '../../prisma/prisma.service';
import { QrService } from '../../qr/qr.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

const OWNER_INCLUDE = {
  salesPerson: {
    select: {
      id: true,
      salesCode: true,
      user: { select: { name: true, email: true } },
    },
  },
  subscriptions: {
    where: { status: 'ACTIVE' as const },
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
} as const;

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
        salesPerson: {
          select: {
            id: true,
            salesCode: true,
            user: { select: { name: true, email: true } },
          },
        },
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
    options?: { salesPersonId?: string; leadId?: string },
  ) {
    const restaurantInput = dto.restaurant;
    const ownerInput = dto.admin || dto.owner;
    const planCode = this.normalizePlanCode(
      dto.subscriptionPlan ||
        dto.subscription?.plan ||
        dto.subscription?.planId ||
        '',
    );

    const salesPersonId =
      options?.salesPersonId || dto.salesPersonId || undefined;
    const leadId = options?.leadId || dto.leadId || undefined;

    if (!ownerInput) {
      throw new BadRequestException('Restaurant admin/owner details are required.');
    }
    if (!planCode) {
      throw new BadRequestException('Subscription plan is required.');
    }

    let pendingLead: {
      id: string;
      salesPersonId: string;
    } | null = null;

    if (leadId) {
      if (!salesPersonId) {
        throw new BadRequestException(
          'salesPersonId is required when processing a Restaurant Lead.',
        );
      }
      const lead = await this.prisma.salesLead.findFirst({
        where: {
          id: leadId,
          salesPersonId,
          convertedRestaurantId: null,
          status: { notIn: [SalesLeadStatus.CONVERTED, SalesLeadStatus.LOST] },
        },
        select: { id: true, salesPersonId: true },
      });
      if (!lead) {
        throw new BadRequestException(
          'This Restaurant Lead is not available for processing (already processed or not found).',
        );
      }
      pendingLead = lead;
    } else if (salesPersonId) {
      const sp = await this.prisma.salesPerson.findUnique({
        where: { id: salesPersonId },
        select: { id: true },
      });
      if (!sp) {
        throw new BadRequestException('Sales Person not found.');
      }
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

    // Supabase round-trips exceed Prisma's default 5s interactive tx timeout.
    const created = await this.prisma.$transaction(
      async (tx) => {
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
            salesPersonId: salesPersonId || null,
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

        const subscription = await tx.subscription.create({
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

        await tx.diningTable.createMany({
          data: Array.from({ length: 10 }, (_, i) => {
            const n = i + 1;
            return {
              restaurantId: restaurant.id,
              label: String(n),
              code: String(n),
              sortOrder: n,
              isActive: true,
            };
          }),
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

        if (pendingLead) {
          const updated = await tx.salesLead.updateMany({
            where: {
              id: pendingLead.id,
              salesPersonId: pendingLead.salesPersonId,
              convertedRestaurantId: null,
              status: {
                notIn: [SalesLeadStatus.CONVERTED, SalesLeadStatus.LOST],
              },
            },
            data: {
              status: SalesLeadStatus.CONVERTED,
              convertedRestaurantId: restaurant.id,
            },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              'This Restaurant Lead was already processed. Restaurant creation aborted.',
            );
          }
        }

        return { restaurant, owner, qr, subscription, planCode: plan.code };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    auditLog('RESTAURANT_CREATED', {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email || null,
      restaurantId: created.restaurant.id,
      restaurantSlug: created.restaurant.slug,
      ownerUserId: created.owner.id,
      qrId: created.qr.id,
      qrToken: created.qr.token,
      salesPersonId: salesPersonId || null,
      leadId: pendingLead?.id || null,
    });

    return {
      message: 'Restaurant created successfully',
      restaurant: {
        id: created.restaurant.id,
        name: created.restaurant.name,
        slug: created.restaurant.slug,
        status: created.restaurant.status,
        createdByUserId: created.restaurant.createdByUserId,
        salesPersonId: created.restaurant.salesPersonId || null,
      },
      owner: {
        id: created.owner.id,
        name: created.owner.name,
        email: created.owner.email,
        role: created.owner.role,
      },
      qr: this.qrService.toPublicQr(created.qr),
      subscription: {
        id: created.subscription.id,
        planCode: created.planCode,
      },
      leadId: pendingLead?.id || null,
    };
  }

  async getOne(id: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id, deletedAt: null },
      include: OWNER_INCLUDE,
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }
    return this.toAdminListItem(restaurant);
  }

  async update(
    id: string,
    dto: UpdateRestaurantDto,
    actor?: { id: string },
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id, deletedAt: null },
      include: {
        memberships: {
          where: { role: MembershipRole.RESTAURANT_OWNER, isActive: true },
          take: 1,
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    if (dto.slug && dto.slug !== restaurant.slug) {
      const slugClash = await this.prisma.restaurant.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (slugClash) {
        throw new ConflictException(
          'A restaurant with this slug already exists.',
        );
      }
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const emailClash = await this.prisma.restaurant.findFirst({
        where: {
          email,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (emailClash) {
        throw new BadRequestException(
          'Another restaurant already uses this email.',
        );
      }
    }

    const owner = restaurant.memberships[0]?.user;
    if (dto.admin?.email && owner) {
      const adminEmail = dto.admin.email.trim().toLowerCase();
      if (adminEmail !== owner.email) {
        const userClash = await this.prisma.user.findFirst({
          where: { email: adminEmail, NOT: { id: owner.id } },
        });
        if (userClash) {
          throw new ConflictException(
            'An account with this email already exists.',
          );
        }
      }
    }

    const coverImageUrl =
      dto.coverImageUrl !== undefined
        ? dto.coverImageUrl
        : dto.coverUrl !== undefined
          ? dto.coverUrl
          : undefined;

    const updated = await this.prisma.$transaction(
      async (tx) => {
        await tx.restaurant.update({
          where: { id },
          data: {
            ...(dto.name != null ? { name: dto.name.trim() } : {}),
            ...(dto.slug != null ? { slug: dto.slug } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description?.trim() || null }
              : {}),
            ...(dto.logoUrl !== undefined
              ? { logoUrl: dto.logoUrl?.trim() || null }
              : {}),
            ...(coverImageUrl !== undefined
              ? { coverImageUrl: coverImageUrl?.trim() || null }
              : {}),
            ...(dto.phone != null ? { phone: dto.phone.trim() } : {}),
            ...(dto.email != null
              ? { email: dto.email.trim().toLowerCase() }
              : {}),
            ...(dto.address != null ? { address: dto.address.trim() } : {}),
            ...(dto.city != null ? { city: dto.city.trim() } : {}),
            ...(dto.state !== undefined
              ? { state: dto.state?.trim() || null }
              : {}),
            ...(dto.pincode !== undefined
              ? { pincode: dto.pincode?.trim() || null }
              : {}),
          },
        });

        if (dto.admin && owner) {
          await tx.user.update({
            where: { id: owner.id },
            data: {
              ...(dto.admin.name != null
                ? { name: dto.admin.name.trim() }
                : {}),
              ...(dto.admin.email != null
                ? { email: dto.admin.email.trim().toLowerCase() }
                : {}),
              ...(dto.admin.phone !== undefined
                ? { phone: dto.admin.phone?.trim() || null }
                : {}),
            },
          });
        }

        return tx.restaurant.findFirstOrThrow({
          where: { id },
          include: OWNER_INCLUDE,
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    auditLog('RESTAURANT_UPDATED', {
      restaurantId: updated.id,
      restaurantSlug: updated.slug,
      adminUserId: actor?.id || null,
    });

    return this.toAdminListItem(updated);
  }

  async softDelete(id: string, actor?: { id: string }) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    await this.prisma.$transaction(
      async (tx) => {
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
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

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
    salesPerson?: {
      id: string;
      salesCode: string;
      user: { name: string; email: string };
    } | null;
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
      salesPerson: r.salesPerson
        ? {
            id: r.salesPerson.id,
            salesCode: r.salesPerson.salesCode,
            name: r.salesPerson.user.name,
            email: r.salesPerson.user.email,
          }
        : null,
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
