import {
  BadRequestException,
  ConflictException,
  Inject,
  ServiceUnavailableException,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  MembershipRole,
  PaymentStatus,
  Prisma,
  QrCodeStatus,
  RestaurantStatus,
  SalesLeadStatus,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { auditLog } from '../../common/audit-log';
import {
  checkoutErrorBody,
  readCheckoutErrorBody,
} from '../../common/checkout-error';
import {
  ACTIVE_PLAN_CODES,
  computeSubscriptionEndsAt,
  getPlanConfig,
  isPaymentRequiredForPlan,
  isSubscriptionPeriodActive,
} from '../../common/subscription-plans';
import { PaymentsService } from '../../payments/payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QrService } from '../../qr/qr.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

function checkoutFailureReason(err: unknown): string {
  if (err && typeof err === 'object' && 'getResponse' in err) {
    const target = err as { getResponse?: () => unknown };
    if (typeof target.getResponse === 'function') {
      try {
        const body = target.getResponse();
        if (typeof body === 'string' && body.trim()) return body.trim();
        if (body && typeof body === 'object' && 'message' in body) {
          const message = (body as { message?: unknown }).message;
          if (typeof message === 'string' && message.trim() && message !== 'Service Unavailable') {
            return message.trim();
          }
        }
      } catch {
        // A detached getResponse throws; fall through to Error.message.
      }
    }
  }
  if (err instanceof Error && err.message.trim() && err.message !== 'Service Unavailable') {
    return err.message.trim();
  }
  return 'Razorpay Checkout could not start.';
}

function isoOrNull(value?: Date | null): string | null {
  if (!value) return null;
  try {
    if (typeof value.getTime === 'function' && Number.isNaN(value.getTime())) {
      return null;
    }
    return typeof value.toISOString === 'function' ? value.toISOString() : null;
  } catch {
    return null;
  }
}

const LIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.PENDING,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.SUSPENDED,
];

const OWNER_INCLUDE = {
  salesPerson: {
    select: {
      id: true,
      salesCode: true,
      user: { select: { name: true, email: true } },
    },
  },
  subscriptions: {
    where: { status: { in: LIVE_SUBSCRIPTION_STATUSES } },
    orderBy: { createdAt: 'desc' },
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
} satisfies Prisma.RestaurantInclude;

@Injectable()
export class AdminRestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: QrService,
    @Optional()
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService?: PaymentsService,
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
          where: { status: { in: LIVE_SUBSCRIPTION_STATUSES } },
          orderBy: { createdAt: 'desc' },
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

  /**
   * A repeated create for a restaurant whose payment never started must reuse
   * that restaurant instead of failing as an unhandled server error.
   */
  private async pendingPaidCheckoutError(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        deletedAt: null,
        status: { not: RestaurantStatus.ARCHIVED },
      },
      select: { id: true, status: true },
    });
    if (!restaurant) return null;
    const pending = await this.prisma.subscription.findFirst({
      where: {
        restaurantId,
        status: SubscriptionStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        plan: { paymentRequired: true },
      },
      select: { id: true },
    });
    if (!pending) return null;
    const paid = await this.prisma.subscription.findFirst({
      where: {
        restaurantId,
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
      },
      select: { id: true },
    });
    if (paid) return null;
    if (restaurant.status === RestaurantStatus.ACTIVE) {
      await this.prisma.restaurant.update({
        where: { id: restaurantId },
        data: { status: RestaurantStatus.SUSPENDED },
      });
    }
    return new ServiceUnavailableException(
      checkoutErrorBody({ restaurantId }),
    );
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
      const pendingError = await this.pendingPaidCheckoutError(existingSlug.id);
      if (pendingError) throw pendingError;
      throw new ConflictException('A restaurant with this slug already exists.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    if (!ACTIVE_PLAN_CODES.includes(planCode as (typeof ACTIVE_PLAN_CODES)[number])) {
      throw new BadRequestException(
        'Selected subscription plan is not available for new restaurants. Choose Free Trial, Monthly, or Launch.',
      );
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) {
      throw new BadRequestException('Selected subscription plan was not found.');
    }

    const planConfig = getPlanConfig(plan.code);
    await this.assertPlanEligibility(plan, {
      isNewRestaurant: true,
      ownerEmail,
      restaurantEmail: String(restaurantInput.email || '')
        .trim()
        .toLowerCase(),
    });

    const startedAt = new Date();
    const endsAt = computeSubscriptionEndsAt(startedAt, {
      billingDays: plan.billingDays || planConfig?.billingDays || 0,
      billingMonths: plan.billingMonths || planConfig?.billingMonths || 0,
    });

    const paymentRequired =
      plan.paymentRequired ??
      planConfig?.paymentRequired ??
      isPaymentRequiredForPlan(plan.code);

    const isTrial =
      plan.planType === 'FREE_TRIAL' || planConfig?.planType === 'FREE_TRIAL';

    const subscriptionStatus = isTrial
      ? SubscriptionStatus.TRIAL
      : paymentRequired
        ? SubscriptionStatus.PENDING
        : SubscriptionStatus.ACTIVE;

    const paymentStatus = isTrial || !paymentRequired
      ? PaymentStatus.PAID
      : PaymentStatus.PENDING;

    // Paid plans: endsAt set after Razorpay confirmation; trial uses computed endsAt.
    const subscriptionEndsAt = isTrial ? endsAt : paymentRequired ? null : endsAt;

    const passwordHash = await bcrypt.hash(password, 12);
    const coverImageUrl =
      restaurantInput.coverImageUrl || restaurantInput.coverUrl || '';

    // Supabase round-trips exceed Prisma's default 5s interactive tx timeout.
    let created;
    try {
    created = await this.prisma.$transaction(
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
            status:
              isTrial || !paymentRequired
                ? RestaurantStatus.ACTIVE
                : RestaurantStatus.SUSPENDED,
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
            status: subscriptionStatus,
            paymentStatus,
            startedAt,
            endsAt: subscriptionEndsAt,
          },
        });

        const branchLimit = plan.branchLimit || planConfig?.branchLimit || 5;
        if (branchLimit < 1) {
          throw new BadRequestException(
            'This subscription plan does not allow any branches.',
          );
        }

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
    } catch (err) {
      const code =
        err && typeof err === 'object' ? (err as { code?: string }).code : '';
      if (code === 'P2002') {
        const existing = await this.prisma.restaurant.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (existing) {
          const pendingError = await this.pendingPaidCheckoutError(existing.id);
          if (pendingError) throw pendingError;
        }
        throw new ConflictException(
          'A restaurant with this slug or owner email already exists.',
        );
      }
      throw err;
    }

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

    let checkout: Awaited<
      ReturnType<PaymentsService['startPaidCheckout']>
    > | null = null;
    const needsPayment =
      paymentRequired &&
      !isTrial &&
      isPaymentRequiredForPlan(plan.code);

    if (needsPayment) {
      if (!this.paymentsService) {
        throw new ServiceUnavailableException(
          checkoutErrorBody({ restaurantId: created.restaurant.id }),
        );
      }
      try {
        checkout = await this.paymentsService.startPaidCheckout(
          created.subscription.id,
        );
      } catch (err) {
        if (readCheckoutErrorBody(err)) throw err;
        auditLog('RAZORPAY_CHECKOUT_START_FAILED', {
          restaurantId: created.restaurant.id,
          subscriptionId: created.subscription.id,
          error: checkoutFailureReason(err)
            .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
            .slice(0, 180),
        });
        throw new ServiceUnavailableException(
          checkoutErrorBody({ restaurantId: created.restaurant.id }),
        );
      }
      if (!checkout?.subscriptionId || !checkout?.keyId) {
        throw new ServiceUnavailableException(
          checkoutErrorBody({ restaurantId: created.restaurant.id }),
        );
      }
    }

    return {
      message: needsPayment
        ? checkout
          ? 'Restaurant created. Complete Razorpay Checkout to activate the paid subscription.'
          : 'Restaurant created. Paid subscription is pending — open billing to start Razorpay Checkout.'
        : 'Restaurant created successfully',
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
        status: created.subscription.status,
        paymentStatus: created.subscription.paymentStatus,
        startedAt: created.subscription.startedAt?.toISOString?.()
          ? created.subscription.startedAt.toISOString()
          : created.subscription.startedAt,
        endsAt: created.subscription.endsAt?.toISOString?.()
          ? created.subscription.endsAt.toISOString()
          : created.subscription.endsAt || null,
        priceAmount: Number(plan.priceAmount),
        billingMonths: plan.billingMonths,
        billingDays: plan.billingDays,
        branchLimit: plan.branchLimit,
        planType: plan.planType,
        paymentRequired: needsPayment,
      },
      checkout,
      leadId: pendingLead?.id || null,
    };
  }

  async getOne(id: string) {
    try {
      await this.paymentsService?.syncFromRazorpayIfNeeded(id);
    } catch {
      // Profile read must succeed even if Razorpay is unreachable.
    }
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
          where: {
            restaurantId: id,
            status: { in: LIVE_SUBSCRIPTION_STATUSES },
          },
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
          where: { status: { in: LIVE_SUBSCRIPTION_STATUSES } },
          orderBy: { createdAt: 'desc' },
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
    return plans.map((p) => {
      const config = getPlanConfig(p.code);
      return {
        id: p.code.toLowerCase(),
        code: p.code,
        name: p.name,
        priceLabel: p.priceLabel,
        priceAmount: Number(p.priceAmount),
        billingMonths: p.billingMonths,
        billingDays: p.billingDays,
        branchLimit: p.branchLimit,
        badge: p.badge || config?.badge || null,
        description: p.description || config?.description || null,
        specialNotice: p.specialNotice || config?.specialNotice || null,
        isNewRestaurantOnly: p.isNewRestaurantOnly,
        planType: p.planType || config?.planType || 'PAID',
        paymentRequired:
          p.paymentRequired ??
          config?.paymentRequired ??
          isPaymentRequiredForPlan(p.code),
        ctaLabel: config?.ctaLabel || `Choose ${p.name}`,
        theme: config?.theme || 'orange',
        features: Array.isArray(p.features) ? p.features : [],
      };
    });
  }

  /**
   * Enforce branch limit from the restaurant's active (non-expired) subscription.
   */
  async assertBranchLimit(restaurantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        restaurantId,
        status: { in: LIVE_SUBSCRIPTION_STATUSES },
      },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });
    if (
      !sub ||
      !isSubscriptionPeriodActive(sub.status, sub.endsAt)
    ) {
      throw new BadRequestException(
        'No active subscription. Complete payment or renew to add branches.',
      );
    }
    const limit = sub.plan?.branchLimit ?? 5;
    const count = await this.prisma.branch.count({ where: { restaurantId } });
    if (count >= limit) {
      throw new BadRequestException(
        `Branch limit reached (${limit}). Upgrade or remove a branch to add another.`,
      );
    }
  }

  /**
   * New-restaurant-only plans (Launch, Free Trial) + one-time free trial abuse guard.
   */
  async assertPlanEligibility(
    plan: {
      code: string;
      isNewRestaurantOnly: boolean;
      planType: string;
    },
    opts: {
      isNewRestaurant: boolean;
      ownerEmail: string;
      restaurantEmail: string;
    },
  ) {
    const config = getPlanConfig(plan.code);
    const newOnly = plan.isNewRestaurantOnly ?? config?.isNewRestaurantOnly;
    if (newOnly && !opts.isNewRestaurant) {
      throw new BadRequestException(
        `${plan.code === 'TRIAL_10_DAYS' ? 'Free Trial' : 'Launch Plan'} is only available for new restaurants.`,
      );
    }

    const isTrial =
      plan.planType === 'FREE_TRIAL' ||
      config?.planType === 'FREE_TRIAL' ||
      plan.code === 'TRIAL_10_DAYS';

    if (!isTrial) return;

    const ownerEmail = opts.ownerEmail.trim().toLowerCase();
    const restaurantEmail = opts.restaurantEmail.trim().toLowerCase();

    const priorTrial = await this.prisma.subscription.findFirst({
      where: {
        plan: { code: 'TRIAL_10_DAYS' },
        restaurant: {
          OR: [
            ...(restaurantEmail ? [{ email: restaurantEmail }] : []),
            ...(ownerEmail
              ? [
                  {
                    memberships: {
                      some: {
                        user: { email: ownerEmail },
                      },
                    },
                  },
                  { email: ownerEmail },
                ]
              : []),
          ],
        },
      },
      select: { id: true },
    });

    if (priorTrial) {
      throw new BadRequestException(
        'This account has already used the 10 Days Free Trial. Choose Monthly or Launch Plan.',
      );
    }
  }

  /**
   * @deprecated Use assertPlanEligibility — kept for callers that only need Launch check.
   */
  async assertLaunchEligibility(
    planCode: string,
    opts: { isNewRestaurant: boolean },
  ) {
    const config = getPlanConfig(planCode);
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: this.normalizePlanCode(planCode) },
    });
    const newOnly = plan?.isNewRestaurantOnly ?? config?.isNewRestaurantOnly;
    if (newOnly && !opts.isNewRestaurant) {
      throw new BadRequestException(
        'Launch Plan is only available for new restaurants.',
      );
    }
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
      status?: string;
      startedAt?: Date;
      endsAt?: Date | null;
      plan: {
        code: string;
        name: string;
        priceLabel: string;
        priceAmount?: unknown;
        billingMonths?: number;
        billingDays?: number;
        branchLimit?: number;
        planType?: string;
      };
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
    const sub = r.subscriptions[0];
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
            name: r.salesPerson.user?.name || '',
            email: r.salesPerson.user?.email || '',
          }
        : null,
      subscriptionPlanId: plan?.code.toLowerCase() || null,
      subscriptionPlan: plan
        ? {
            id: plan.code.toLowerCase(),
            name: plan.name,
            priceLabel: plan.priceLabel,
            priceAmount:
              plan.priceAmount != null ? Number(plan.priceAmount) : undefined,
            billingMonths: plan.billingMonths,
            billingDays: plan.billingDays,
            branchLimit: plan.branchLimit,
            planType: plan.planType,
          }
        : null,
      subscription: sub
        ? {
            status: sub.status || null,
            paymentStatus: (sub as any).paymentStatus || null,
            startedAt: isoOrNull(sub.startedAt),
            endsAt: isoOrNull(sub.endsAt),
            nextPaymentAt: isoOrNull((sub as any).nextPaymentAt),
            lastPaymentAt: isoOrNull((sub as any).lastPaymentAt),
            gracePeriodEndsAt: isoOrNull((sub as any).gracePeriodEndsAt),
            razorpaySubscriptionId:
              (sub as any).razorpaySubscriptionId || null,
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
