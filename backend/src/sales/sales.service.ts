import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommissionStatus,
  QrCodeStatus,
  RestaurantStatus,
  SalesLeadStatus,
  SalesPersonStatus,
  UserRole,
} from '@prisma/client';
import { AdminRestaurantsService } from '../admin/restaurants/admin-restaurants.service';
import { CreateRestaurantDto } from '../admin/restaurants/dto/create-restaurant.dto';
import { auditLog } from '../common/audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { CommissionService } from './commission.service';
import { SalesContextService } from './sales-context.service';
import {
  parseMonthlyPriceLabel,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './sales.utils';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesContext: SalesContextService,
    private readonly adminRestaurants: AdminRestaurantsService,
    private readonly commissionService: CommissionService,
    private readonly qrService: QrService,
  ) {}

  async getProfile(user: { id: string; role: string }) {
    const sp = await this.salesContext.requireSalesPerson(user);
    return {
      id: sp.id,
      salesCode: sp.salesCode,
      name: sp.user.name,
      email: sp.user.email,
      phone: sp.phone || sp.user.phone || '',
      status: sp.status,
      joinedAt: sp.createdAt.toISOString(),
    };
  }

  async updateProfile(
    user: { id: string; role: string },
    body: { name?: string; phone?: string },
  ) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const name = body.name != null ? String(body.name).trim() : undefined;
    const phone = body.phone != null ? String(body.phone).trim() : undefined;

    if (name !== undefined && !name) {
      throw new BadRequestException('Name cannot be empty.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: sp.userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(phone !== undefined ? { phone: phone || null } : {}),
        },
      }),
      this.prisma.salesPerson.update({
        where: { id: sp.id },
        data: {
          ...(phone !== undefined ? { phone: phone || null } : {}),
        },
      }),
    ]);

    return this.getProfile(user);
  }

  async createRestaurant(
    user: { id: string; email?: string; role: string },
    dto: CreateRestaurantDto,
  ) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const created = await this.adminRestaurants.create(
      dto,
      { id: user.id, email: user.email },
      { salesPersonId: sp.id },
    );

    if (created.subscription?.id && created.restaurant?.id) {
      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { code: created.subscription.planCode },
      });
      await this.commissionService.ensureCommissionForSubscription({
        salesPersonId: sp.id,
        restaurantId: created.restaurant.id,
        subscriptionId: created.subscription.id,
        planCode: created.subscription.planCode,
        priceLabel: plan?.priceLabel,
      });
    }

    auditLog('SALES_RESTAURANT_CREATED', {
      salesPersonId: sp.id,
      salesCode: sp.salesCode,
      restaurantId: created.restaurant.id,
    });

    return created;
  }

  async listPlans(user: { id: string; role: string }) {
    await this.salesContext.requireSalesPerson(user);
    return this.adminRestaurants.listPlans();
  }

  async listRestaurants(user: { id: string; role: string }) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const rows = await this.prisma.restaurant.findMany({
      where: {
        salesPersonId: sp.id,
        deletedAt: null,
        NOT: { status: RestaurantStatus.ARCHIVED },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { plan: true },
        },
        qrCodes: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return rows.map((r) => this.toSalesRestaurant(r));
  }

  async getRestaurant(user: { id: string; role: string }, restaurantId: string) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const r = await this.prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        salesPersonId: sp.id,
        deletedAt: null,
      },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { plan: true },
        },
        qrCodes: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!r) throw new NotFoundException('Restaurant not found.');
    return this.toSalesRestaurant(r);
  }

  async listQr(user: { id: string; role: string }) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const restaurants = await this.prisma.restaurant.findMany({
      where: {
        salesPersonId: sp.id,
        deletedAt: null,
        NOT: { status: RestaurantStatus.ARCHIVED },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        qrCodes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return restaurants.flatMap((r) =>
      r.qrCodes.map((qr) => ({
        restaurantName: r.name,
        restaurantSlug: r.slug,
        ...this.qrService.toPublicQr(qr, r.slug),
        restaurantId: r.id,
      })),
    );
  }

  async getDashboard(user: { id: string; role: string }) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();

    const restaurants = await this.prisma.restaurant.findMany({
      where: { salesPersonId: sp.id, deletedAt: null },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { plan: true },
        },
        qrCodes: { where: { status: 'ACTIVE' } },
      },
    });

    const nonArchived = restaurants.filter(
      (r) => r.status !== RestaurantStatus.ARCHIVED,
    );
    const active = nonArchived.filter((r) => r.status === RestaurantStatus.ACTIVE);
    const pending = nonArchived.filter(
      (r) => r.status === RestaurantStatus.SUSPENDED,
    );
    const addedThisWeek = nonArchived.filter((r) => r.createdAt >= weekStart);
    const addedThisMonth = nonArchived.filter((r) => r.createdAt >= monthStart);
    const qrCount = nonArchived.reduce((n, r) => n + r.qrCodes.length, 0);
    const activeSubscriptions = nonArchived.filter(
      (r) => r.subscriptions.length > 0,
    ).length;

    const monthlyRevenue = nonArchived
      .filter((r) => r.createdAt >= monthStart || r.subscriptions[0])
      .reduce((sum, r) => {
        const label = r.subscriptions[0]?.plan?.priceLabel;
        return sum + parseMonthlyPriceLabel(label);
      }, 0);

    // Monthly revenue attributed to active subscriptions of this SP's restaurants
    const subscriptionRevenue = nonArchived.reduce((sum, r) => {
      return sum + parseMonthlyPriceLabel(r.subscriptions[0]?.plan?.priceLabel);
    }, 0);

    const commissions = await this.prisma.commission.findMany({
      where: { salesPersonId: sp.id },
    });
    const commissionEarned = commissions
      .filter((c) => c.status !== CommissionStatus.CANCELLED)
      .reduce((s, c) => s + Number(c.amount), 0);

    const weekly = this.buildWeeklyOnboarding(nonArchived);

    return {
      metrics: {
        restaurantsAdded: nonArchived.length,
        restaurantsActive: active.length,
        restaurantsPending: pending.length,
        qrCodesGenerated: qrCount,
        monthlyRevenue,
        subscriptionRevenue,
        commissionEarned,
        restaurantsAddedThisWeek: addedThisWeek.length,
        restaurantsAddedThisMonth: addedThisMonth.length,
        activeSubscriptions,
      },
      weeklyPerformance: weekly,
      commissionRulesConfigured: (await this.commissionService.listRules()).length > 0,
    };
  }

  async getAnalytics(user: { id: string; role: string }, range = 'all') {
    const sp = await this.salesContext.requireSalesPerson(user);
    const since = this.rangeStart(range);

    const restaurants = await this.prisma.restaurant.findMany({
      where: {
        salesPersonId: sp.id,
        deletedAt: null,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      include: {
        subscriptions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const nonArchived = restaurants.filter(
      (r) => r.status !== RestaurantStatus.ARCHIVED,
    );
    const active = nonArchived.filter((r) => r.status === RestaurantStatus.ACTIVE);
    const inactive = nonArchived.filter((r) => r.status !== RestaurantStatus.ACTIVE);

    const weekStart = startOfWeek();
    const monthStart = startOfMonth();
    const allForSp = await this.prisma.restaurant.findMany({
      where: { salesPersonId: sp.id, deletedAt: null },
      select: { createdAt: true, status: true },
    });
    const allNonArchived = allForSp.filter(
      (r) => r.status !== RestaurantStatus.ARCHIVED,
    );

    const planBreakdown: Record<string, number> = {};
    let subscriptionRevenue = 0;
    for (const r of nonArchived) {
      const plan = r.subscriptions[0]?.plan;
      const key = plan?.name || plan?.code || 'None';
      planBreakdown[key] = (planBreakdown[key] || 0) + 1;
      subscriptionRevenue += parseMonthlyPriceLabel(plan?.priceLabel);
    }

    const avgRevenue =
      nonArchived.length > 0
        ? Math.round((subscriptionRevenue / nonArchived.length) * 100) / 100
        : 0;

    const byDay: Record<string, number> = {};
    for (const r of nonArchived) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDay[key] = (byDay[key] || 0) + 1;
    }

    const monthlyBuckets: Record<string, number> = {};
    for (const r of nonArchived) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const price = parseMonthlyPriceLabel(r.subscriptions[0]?.plan?.priceLabel);
      monthlyBuckets[key] = (monthlyBuckets[key] || 0) + price;
    }

    const subscriptionRows = nonArchived.map((r) => {
      const sub = r.subscriptions[0];
      return {
        restaurantId: r.id,
        restaurantName: r.name,
        planCode: sub?.plan?.code || null,
        planName: sub?.plan?.name || null,
        priceLabel: sub?.plan?.priceLabel || null,
        monthlyAmount: parseMonthlyPriceLabel(sub?.plan?.priceLabel),
        status: sub?.status || null,
        startedAt: sub?.startedAt?.toISOString() || null,
        restaurantStatus: r.status,
        addedAt: r.createdAt.toISOString(),
      };
    });

    return {
      range,
      totals: {
        restaurantsAdded: nonArchived.length,
        activeRestaurants: active.length,
        inactiveRestaurants: inactive.length,
        restaurantsAddedThisWeek: allNonArchived.filter((r) => r.createdAt >= weekStart)
          .length,
        restaurantsAddedThisMonth: allNonArchived.filter(
          (r) => r.createdAt >= monthStart,
        ).length,
        subscriptionRevenue,
        averageRevenuePerRestaurant: avgRevenue,
      },
      planBreakdown: Object.entries(planBreakdown).map(([plan, count]) => ({
        plan,
        count,
      })),
      restaurantsAddedOverTime: Object.entries(byDay).map(([date, count]) => ({
        date,
        count,
      })),
      monthlyRevenue: Object.entries(monthlyBuckets).map(([month, amount]) => ({
        month,
        amount,
      })),
      subscriptions: subscriptionRows,
    };
  }

  async getCommission(user: { id: string; role: string }) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const rules = await this.commissionService.listRules();
    const rows = await this.prisma.commission.findMany({
      where: { salesPersonId: sp.id },
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: { select: { id: true, name: true } },
      },
    });

    const monthStart = startOfMonth();
    const yearStart = startOfYear();

    const sum = (list: typeof rows) =>
      list.reduce((s, c) => s + Number(c.amount), 0);

    const nonCancelled = rows.filter((c) => c.status !== CommissionStatus.CANCELLED);
    const pending = rows.filter((c) => c.status === CommissionStatus.PENDING);
    const approved = rows.filter((c) => c.status === CommissionStatus.APPROVED);
    const paid = rows.filter((c) => c.status === CommissionStatus.PAID);

    return {
      rulesConfigured: rules.length > 0,
      rules: rules.map((r) => ({
        planCode: r.planCode,
        type: r.type,
        value: Number(r.value),
      })),
      summary: {
        totalEarned: sum(nonCancelled),
        pending: sum(pending),
        approved: sum(approved),
        paid: sum(paid),
        thisMonth: sum(
          nonCancelled.filter((c) => c.createdAt >= monthStart),
        ),
        thisYear: sum(nonCancelled.filter((c) => c.createdAt >= yearStart)),
      },
      history: rows.map((c) => ({
        id: c.id,
        restaurantId: c.restaurantId,
        restaurantName: c.restaurant.name,
        planCode: c.planCode,
        amount: Number(c.amount),
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        paidAt: c.paidAt?.toISOString() || null,
      })),
      message:
        rules.length === 0
          ? 'Commission rules coming soon. History will appear once rules are configured.'
          : null,
    };
  }

  async listLeads(user: { id: string; role: string }) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const leads = await this.prisma.salesLead.findMany({
      where: { salesPersonId: sp.id },
      orderBy: { createdAt: 'desc' },
    });
    return leads.map((l) => this.toLeadDto(l));
  }

  async createLead(
    user: { id: string; role: string },
    body: {
      contactName?: string;
      restaurantName?: string;
      phone?: string;
      email?: string;
      notes?: string;
      status?: string;
    },
  ) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const contactName = String(body.contactName || '').trim();
    const restaurantName = String(body.restaurantName || '').trim();
    if (!contactName || !restaurantName) {
      throw new BadRequestException('Contact name and restaurant name are required.');
    }

    const status = this.parseLeadStatus(body.status) || SalesLeadStatus.NEW;
    const lead = await this.prisma.salesLead.create({
      data: {
        salesPersonId: sp.id,
        contactName,
        restaurantName,
        phone: body.phone?.trim() || null,
        email: body.email?.trim().toLowerCase() || null,
        notes: body.notes?.trim() || null,
        status,
      },
    });
    return this.toLeadDto(lead);
  }

  async updateLead(
    user: { id: string; role: string },
    leadId: string,
    body: {
      contactName?: string;
      restaurantName?: string;
      phone?: string;
      email?: string;
      notes?: string;
      status?: string;
      convertedRestaurantId?: string | null;
    },
  ) {
    const sp = await this.salesContext.requireSalesPerson(user);
    const existing = await this.prisma.salesLead.findFirst({
      where: { id: leadId, salesPersonId: sp.id },
    });
    if (!existing) throw new NotFoundException('Lead not found.');

    const data: Record<string, unknown> = {};
    if (body.contactName !== undefined) data.contactName = String(body.contactName).trim();
    if (body.restaurantName !== undefined) {
      data.restaurantName = String(body.restaurantName).trim();
    }
    if (body.phone !== undefined) data.phone = String(body.phone).trim() || null;
    if (body.email !== undefined) {
      data.email = String(body.email).trim().toLowerCase() || null;
    }
    if (body.notes !== undefined) data.notes = String(body.notes).trim() || null;
    if (body.status !== undefined) {
      const status = this.parseLeadStatus(body.status);
      if (!status) throw new BadRequestException('Invalid lead status.');
      data.status = status;
    }
    if (body.convertedRestaurantId !== undefined) {
      const rid = body.convertedRestaurantId;
      if (rid) {
        const owned = await this.prisma.restaurant.findFirst({
          where: { id: rid, salesPersonId: sp.id, deletedAt: null },
          select: { id: true },
        });
        if (!owned) {
          throw new BadRequestException(
            'Converted restaurant must belong to this Sales Person.',
          );
        }
        data.convertedRestaurantId = owned.id;
        data.status = SalesLeadStatus.CONVERTED;
      } else {
        data.convertedRestaurantId = null;
      }
    }

    const updated = await this.prisma.salesLead.update({
      where: { id: leadId },
      data,
    });
    return this.toLeadDto(updated);
  }

  /** Super Admin: create a Sales Person account. */
  async adminCreateSalesPerson(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    const name = String(input.name || '').trim();
    const phone = String(input.phone || '').trim();
    const password = String(input.password || '');
    if (!email || !name || !phone || password.length < 8) {
      throw new BadRequestException(
        'Name, phone, email, and password (min 8 chars) are required.',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        'A Sales Person with this email already exists.',
      );
    }

    const phoneClash = await this.prisma.salesPerson.findFirst({
      where: { phone },
      select: { id: true },
    });
    if (phoneClash) {
      throw new BadRequestException(
        'A Sales Person with this phone number already exists.',
      );
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);
    const salesCode = await this.nextSalesCode();

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role: UserRole.SALES_PERSON,
          isActive: true,
        },
      });
      const profile = await tx.salesPerson.create({
        data: {
          userId: user.id,
          salesCode,
          phone,
          status: SalesPersonStatus.ACTIVE,
        },
      });
      return { user, profile };
    });

    auditLog('SALES_PERSON_CREATED', {
      salesPersonId: created.profile.id,
      salesCode: created.profile.salesCode,
      email,
    });

    return {
      id: created.profile.id,
      salesCode: created.profile.salesCode,
      name: created.user.name,
      email: created.user.email,
      phone: created.profile.phone || '',
      status: created.profile.status,
      restaurantsAdded: 0,
      activeRestaurants: 0,
      createdAt: created.profile.createdAt.toISOString(),
    };
  }

  async adminListSalesPersons() {
    const rows = await this.prisma.salesPerson.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true, isActive: true } },
        restaurants: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
    });
    return rows.map((r) => this.toAdminSalesPersonDto(r));
  }

  async adminGetSalesPerson(id: string) {
    const row = await this.prisma.salesPerson.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, phone: true, isActive: true } },
        restaurants: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Sales Person not found.');
    return {
      ...this.toAdminSalesPersonDto(row),
      restaurants: row.restaurants.map((rest) => ({
        id: rest.id,
        name: rest.name,
        status: rest.status,
        createdAt: rest.createdAt.toISOString(),
      })),
    };
  }

  async adminSetSalesPersonStatus(id: string, statusRaw: string) {
    const status = String(statusRaw || '')
      .trim()
      .toUpperCase();
    if (
      status !== SalesPersonStatus.ACTIVE &&
      status !== SalesPersonStatus.INACTIVE
    ) {
      throw new BadRequestException('Status must be ACTIVE or INACTIVE.');
    }

    const existing = await this.prisma.salesPerson.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!existing) throw new NotFoundException('Sales Person not found.');

    await this.prisma.$transaction([
      this.prisma.salesPerson.update({
        where: { id },
        data: { status: status as SalesPersonStatus },
      }),
      this.prisma.user.update({
        where: { id: existing.userId },
        data: { isActive: status === SalesPersonStatus.ACTIVE },
      }),
    ]);

    auditLog('SALES_PERSON_STATUS_CHANGED', {
      salesPersonId: id,
      salesCode: existing.salesCode,
      status,
    });

    return this.adminGetSalesPerson(id);
  }

  private toAdminSalesPersonDto(r: {
    id: string;
    salesCode: string;
    phone: string | null;
    status: SalesPersonStatus;
    createdAt: Date;
    user: { name: string; email: string; phone: string | null };
    restaurants: Array<{ status: RestaurantStatus }>;
  }) {
    const restaurantsAdded = r.restaurants.length;
    const activeRestaurants = r.restaurants.filter(
      (rest) => rest.status === RestaurantStatus.ACTIVE,
    ).length;
    return {
      id: r.id,
      salesCode: r.salesCode,
      name: r.user.name,
      email: r.user.email,
      phone: r.phone || r.user.phone || '',
      status: r.status,
      restaurantsAdded,
      activeRestaurants,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async nextSalesCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const count = await this.prisma.salesPerson.count();
      const code = `SP${String(count + 1 + i).padStart(5, '0')}`;
      const clash = await this.prisma.salesPerson.findUnique({
        where: { salesCode: code },
      });
      if (!clash) return code;
    }
    return `SP${Date.now().toString().slice(-5)}`;
  }

  private buildWeeklyOnboarding(
    restaurants: Array<{ createdAt: Date }>,
  ): Array<{ day: string; count: number }> {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekStart = startOfWeek();
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const r of restaurants) {
      if (r.createdAt < weekStart) continue;
      const day = (r.createdAt.getDay() + 6) % 7; // Mon=0
      if (day >= 0 && day < 7) counts[day] += 1;
    }
    return labels.map((day, i) => ({ day, count: counts[i] }));
  }

  private rangeStart(range: string): Date | null {
    const now = new Date();
    switch (String(range || 'all').toLowerCase()) {
      case 'week':
        return startOfWeek(now);
      case 'month':
        return startOfMonth(now);
      case '3m':
      case 'last3months': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        return d;
      }
      case '6m':
      case 'last6months': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 6);
        return d;
      }
      default:
        return null;
    }
  }

  private parseLeadStatus(raw?: string): SalesLeadStatus | null {
    if (!raw) return null;
    const key = String(raw).trim().toUpperCase();
    return (Object.values(SalesLeadStatus) as string[]).includes(key)
      ? (key as SalesLeadStatus)
      : null;
  }

  private toLeadDto(l: {
    id: string;
    contactName: string;
    restaurantName: string;
    phone: string | null;
    email: string | null;
    status: SalesLeadStatus;
    notes: string | null;
    convertedRestaurantId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: l.id,
      contactName: l.contactName,
      restaurantName: l.restaurantName,
      phone: l.phone || '',
      email: l.email || '',
      status: l.status,
      notes: l.notes || '',
      convertedRestaurantId: l.convertedRestaurantId,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }

  private toSalesRestaurant(r: {
    id: string;
    name: string;
    slug: string;
    phone: string;
    email: string;
    city: string;
    status: RestaurantStatus;
    createdAt: Date;
    subscriptions: Array<{
      status: string;
      startedAt: Date;
      plan: { code: string; name: string; priceLabel: string };
    }>;
    qrCodes: Array<{
      id: string;
      token: string;
      targetUrl: string;
      status: QrCodeStatus;
      createdAt: Date;
      updatedAt: Date;
      restaurantId: string;
    }>;
  }) {
    const plan = r.subscriptions[0]?.plan;
    const qr = r.qrCodes[0];
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      phone: r.phone,
      email: r.email,
      city: r.city,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      subscription: plan
        ? {
            planCode: plan.code,
            planName: plan.name,
            priceLabel: plan.priceLabel,
            status: r.subscriptions[0]?.status || null,
            startedAt: r.subscriptions[0]?.startedAt?.toISOString() || null,
            monthlyAmount: parseMonthlyPriceLabel(plan.priceLabel),
          }
        : null,
      qr: qr ? this.qrService.toPublicQr(qr, r.slug) : null,
    };
  }
}
