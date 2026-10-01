import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoyaltyCustomerStatus,
  LoyaltyOfferStatus,
  LoyaltyOfferType,
  LoyaltyProgramType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { auditLog } from '../common/audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import {
  CreateLoyaltyCustomerDto,
  LoyaltyCustomerListQueryDto,
  SendLoyaltyWhatsappDto,
  UpdateLoyaltyCustomerDto,
  UpdateLoyaltyProgramDto,
} from './dto/loyalty.dto';
import {
  loyaltyProgramList,
  LOYALTY_PROGRAM_DEFINITIONS,
} from './loyalty-programs';
import { ProgramCouponSync } from './program-coupon.sync';
import { readLinkedCouponId } from './program-coupon';
import { LoyaltyWhatsappService } from './whatsapp/loyalty-whatsapp.service';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantContext: RestaurantContextService,
    private readonly whatsapp: LoyaltyWhatsappService,
    private readonly programCoupons: ProgramCouponSync,
  ) {}

  async getStats(user: { id: string; role: UserRole; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalCustomers, activeCustomers, addedThisMonth, offersSent] =
      await Promise.all([
        this.prisma.loyaltyCustomer.count({
          where: { restaurantId: ctx.restaurantId },
        }),
        this.prisma.loyaltyCustomer.count({
          where: {
            restaurantId: ctx.restaurantId,
            status: LoyaltyCustomerStatus.ACTIVE,
          },
        }),
        this.prisma.loyaltyCustomer.count({
          where: {
            restaurantId: ctx.restaurantId,
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.loyaltyOfferMessage.count({
          where: {
            restaurantId: ctx.restaurantId,
            status: { in: [LoyaltyOfferStatus.SENT, LoyaltyOfferStatus.DELIVERED] },
          },
        }),
      ]);

    return {
      totalCustomers,
      activeCustomers,
      customersAddedThisMonth: addedThisMonth,
      offersSent,
    };
  }

  async listCustomers(
    user: { id: string; role: UserRole; restaurantId?: string },
    query: LoyaltyCustomerListQueryDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;
    const search = String(query.search || '').trim();
    const filter = String(query.filter || 'all').toLowerCase();
    const sort = String(query.sort || 'recent').toLowerCase();

    const where: Prisma.LoyaltyCustomerWhereInput = {
      restaurantId: ctx.restaurantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { whatsappPhone: { contains: search } },
      ];
    }

    if (filter === 'active') where.status = LoyaltyCustomerStatus.ACTIVE;
    if (filter === 'inactive') where.status = LoyaltyCustomerStatus.INACTIVE;
    if (filter === 'opted_in') where.marketingConsent = true;
    if (filter === 'opted_out') where.marketingConsent = false;

    const orderBy: Prisma.LoyaltyCustomerOrderByWithRelationInput[] =
      sort === 'name'
        ? [{ name: 'asc' }]
        : sort === 'offers'
          ? [{ totalOffersSent: 'desc' }, { createdAt: 'desc' }]
          : sort === 'last_offer'
            ? [{ lastOfferSentAt: 'desc' }, { createdAt: 'desc' }]
            : [{ createdAt: 'desc' }];

    const [total, rows] = await Promise.all([
      this.prisma.loyaltyCustomer.count({ where }),
      this.prisma.loyaltyCustomer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          phone: true,
          whatsappPhone: true,
          email: true,
          notes: true,
          marketingConsent: true,
          status: true,
          totalOffersSent: true,
          lastOfferSentAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.toCustomerListItem(row)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async createCustomer(
    user: { id: string; role: UserRole; restaurantId?: string },
    dto: CreateLoyaltyCustomerDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const name = String(dto.name || '').trim();
    const phone = this.normalizeIndianPhone(dto.phone);
    const whatsappPhone = this.normalizeIndianPhone(dto.whatsappPhone || dto.phone);
    const email = dto.email ? String(dto.email).trim().toLowerCase() : null;
    const notes = dto.notes ? String(dto.notes).trim() : null;

    await this.ensureNoDuplicateCustomer(ctx.restaurantId, phone, whatsappPhone);

    try {
      const created = await this.prisma.loyaltyCustomer.create({
        data: {
          restaurantId: ctx.restaurantId,
          name,
          phone,
          whatsappPhone,
          email,
          notes,
          marketingConsent: dto.marketingConsent === true,
          createdByUserId: user.id,
        },
      });

      auditLog('LOYALTY_CUSTOMER_CREATED', {
        restaurantId: ctx.restaurantId,
        customerId: created.id,
        userId: user.id,
      });

      return this.toCustomerDetail(created, []);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'This customer is already added to your Loyalty Program.',
        );
      }
      throw err;
    }
  }

  async getCustomer(
    user: { id: string; role: UserRole; restaurantId?: string },
    id: string,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const customer = await this.prisma.loyaltyCustomer.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        offers: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            sentBy: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
    return this.toCustomerDetail(customer, customer.offers);
  }

  async updateCustomer(
    user: { id: string; role: UserRole; restaurantId?: string },
    id: string,
    dto: UpdateLoyaltyCustomerDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const existing = await this.prisma.loyaltyCustomer.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
    });
    if (!existing) throw new NotFoundException('Customer not found.');

    const phone =
      dto.phone != null ? this.normalizeIndianPhone(dto.phone) : existing.phone;
    const whatsappPhone =
      dto.whatsappPhone != null
        ? this.normalizeIndianPhone(dto.whatsappPhone)
        : dto.phone != null
          ? phone
          : existing.whatsappPhone;

    await this.ensureNoDuplicateCustomer(ctx.restaurantId, phone, whatsappPhone, id);

    const updated = await this.prisma.loyaltyCustomer.update({
      where: { id: existing.id },
      data: {
        ...(dto.name != null ? { name: String(dto.name).trim() } : {}),
        ...(dto.phone != null ? { phone } : {}),
        ...(dto.whatsappPhone != null || dto.phone != null
          ? { whatsappPhone }
          : {}),
        ...(dto.email !== undefined
          ? {
              email:
                dto.email && String(dto.email).trim() !== ''
                  ? String(dto.email).trim().toLowerCase()
                  : null,
            }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes ? String(dto.notes).trim() : null }
          : {}),
        ...(dto.marketingConsent !== undefined
          ? { marketingConsent: dto.marketingConsent === true }
          : {}),
        ...(dto.status ? { status: dto.status as LoyaltyCustomerStatus } : {}),
      },
    });

    auditLog('LOYALTY_CUSTOMER_UPDATED', {
      restaurantId: ctx.restaurantId,
      customerId: updated.id,
      userId: user.id,
    });

    return this.toCustomerDetail(updated, []);
  }

  async deleteCustomer(
    user: { id: string; role: UserRole; restaurantId?: string },
    id: string,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const existing = await this.prisma.loyaltyCustomer.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException('Customer not found.');

    await this.prisma.loyaltyCustomer.delete({ where: { id: existing.id } });

    auditLog('LOYALTY_CUSTOMER_DELETED', {
      restaurantId: ctx.restaurantId,
      customerId: existing.id,
      userId: user.id,
    });

    return { message: `Customer "${existing.name}" deleted successfully.` };
  }

  async sendWhatsappOffer(
    user: { id: string; role: UserRole; restaurantId?: string },
    customerId: string,
    dto: SendLoyaltyWhatsappDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const customer = await this.prisma.loyaltyCustomer.findFirst({
      where: { id: customerId, restaurantId: ctx.restaurantId },
    });
    if (!customer) throw new NotFoundException('Customer not found.');
    if (!customer.marketingConsent) {
      throw new BadRequestException(
        'This customer has not opted in to receive WhatsApp promotional messages.',
      );
    }

    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: ctx.restaurantId, deletedAt: null },
      select: { name: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found.');

    const payload = this.buildOfferPayload(dto, {
      customerName: customer.name,
      restaurantName: restaurant.name,
    });

    const initial = await this.prisma.loyaltyOfferMessage.create({
      data: {
        restaurantId: ctx.restaurantId,
        customerId: customer.id,
        offerType: dto.offerType as LoyaltyOfferType,
        title: payload.title,
        message: payload.message,
        couponCode: payload.couponCode,
        discountPercent:
          payload.discountPercent != null
            ? new Prisma.Decimal(payload.discountPercent)
            : null,
        minimumOrderValue:
          payload.minimumOrderValue != null
            ? new Prisma.Decimal(payload.minimumOrderValue)
            : null,
        expiresAt: payload.expiresAt,
        sentByUserId: user.id,
        status: LoyaltyOfferStatus.PENDING,
      },
    });

    const providerResult = await this.whatsapp.sendPromotionalMessage({
      to: customer.whatsappPhone,
      message: payload.message,
    });

    const finalStatus = providerResult.ok
      ? (providerResult.status as LoyaltyOfferStatus)
      : LoyaltyOfferStatus.FAILED;
    const sentAt = providerResult.ok ? new Date() : null;

    const updated = await this.prisma.loyaltyOfferMessage.update({
      where: { id: initial.id },
      data: {
        status: finalStatus,
        sentAt,
        providerMessageId: providerResult.providerMessageId || null,
        providerPayload: providerResult.providerPayload
          ? (providerResult.providerPayload as Prisma.InputJsonValue)
          : undefined,
        failureReason: providerResult.failureReason || null,
      },
    });

    if (providerResult.ok) {
      await this.prisma.loyaltyCustomer.update({
        where: { id: customer.id },
        data: {
          totalOffersSent: { increment: 1 },
          lastOfferSentAt: sentAt,
        },
      });
    }

    auditLog('LOYALTY_WHATSAPP_OFFER_ATTEMPT', {
      restaurantId: ctx.restaurantId,
      customerId: customer.id,
      offerId: updated.id,
      status: updated.status,
      userId: user.id,
    });

    return {
      id: updated.id,
      status: updated.status,
      message: providerResult.ok
        ? 'WhatsApp offer sent successfully.'
        : providerResult.failureReason ||
          'WhatsApp offer could not be sent.',
      failureReason: updated.failureReason,
    };
  }

  async listPrograms(user: { id: string; role: UserRole; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const programs = await this.ensurePrograms(ctx.restaurantId);
    return {
      items: programs.map((p) => {
        const meta = LOYALTY_PROGRAM_DEFINITIONS[p.programType];
        return {
          id: p.id,
          programType: p.programType,
          title: meta.title,
          summary: meta.summary,
          enabled: p.enabled,
          configuration: p.configuration,
        };
      }),
    };
  }

  async updateProgram(
    user: { id: string; role: UserRole; restaurantId?: string },
    rawProgramType: string,
    dto: UpdateLoyaltyProgramDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const programType = String(rawProgramType || '').trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(LOYALTY_PROGRAM_DEFINITIONS, programType)) {
      throw new BadRequestException('Invalid loyalty program type.');
    }

    await this.ensurePrograms(ctx.restaurantId);
    const current = await this.prisma.restaurantLoyaltyProgram.findUnique({
      where: {
        restaurantId_programType: {
          restaurantId: ctx.restaurantId,
          programType: programType as LoyaltyProgramType,
        },
      },
    });
    const configuration = {
      ...(dto.configuration || {}),
    } as Record<string, unknown>;
    const linkedCouponId = readLinkedCouponId(current?.configuration);
    if (linkedCouponId && !configuration.linkedCouponId) {
      configuration.linkedCouponId = linkedCouponId;
    }
    const enabled = dto.enabled === true;
    const synced = await this.programCoupons.syncProgram(
      ctx.restaurantId,
      { programType, enabled, configuration },
      user.id,
    );
    const updated = await this.prisma.restaurantLoyaltyProgram.update({
      where: {
        restaurantId_programType: {
          restaurantId: ctx.restaurantId,
          programType: programType as LoyaltyProgramType,
        },
      },
      data: {
        enabled,
        configuration: synced,
      },
    });

    auditLog('LOYALTY_PROGRAM_UPDATED', {
      restaurantId: ctx.restaurantId,
      programType: updated.programType,
      userId: user.id,
    });

    return {
      id: updated.id,
      programType: updated.programType,
      enabled: updated.enabled,
      configuration: updated.configuration,
    };
  }

  private async ensurePrograms(restaurantId: string) {
    const existing = await this.prisma.restaurantLoyaltyProgram.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing.length === loyaltyProgramList().length) return existing;

    const existingTypes = new Set(existing.map((p) => p.programType));
    const missing = loyaltyProgramList().filter(
      (program) => !existingTypes.has(program.programType),
    );

    if (missing.length) {
      await this.prisma.restaurantLoyaltyProgram.createMany({
        data: missing.map((program) => ({
          restaurantId,
          programType: program.programType,
          enabled: false,
          configuration: program.defaultConfiguration as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
    }

    return this.prisma.restaurantLoyaltyProgram.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private normalizeIndianPhone(input: string) {
    const digits = String(input || '').replace(/\D/g, '');
    let normalized = digits;
    if (normalized.length === 12 && normalized.startsWith('91')) {
      normalized = normalized.slice(2);
    }
    if (normalized.length === 11 && normalized.startsWith('0')) {
      normalized = normalized.slice(1);
    }
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      throw new BadRequestException('Enter a valid Indian phone number.');
    }
    return `+91${normalized}`;
  }

  private async ensureNoDuplicateCustomer(
    restaurantId: string,
    phone: string,
    whatsappPhone: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.loyaltyCustomer.findFirst({
      where: {
        restaurantId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        OR: [
          { phone },
          { whatsappPhone: phone },
          { phone: whatsappPhone },
          { whatsappPhone },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This customer is already added to your Loyalty Program.',
      );
    }
  }

  private buildOfferPayload(
    dto: SendLoyaltyWhatsappDto,
    vars: { customerName: string; restaurantName: string },
  ) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.expiresAt && Number.isNaN(expiresAt?.getTime())) {
      throw new BadRequestException('Invalid expiry date.');
    }

    const title =
      dto.title?.trim() ||
      (dto.offerType === 'COUPON'
        ? 'Coupon Offer'
        : dto.offerType === 'DISCOUNT'
          ? 'Discount Offer'
          : dto.offerType === 'SPECIAL_OFFER'
            ? 'Special Offer'
            : 'Custom Message');

    if (dto.offerType === 'COUPON') {
      if (!dto.couponCode || !dto.offerDescription) {
        throw new BadRequestException(
          'Coupon code and offer description are required.',
        );
      }
    }
    if (dto.offerType === 'DISCOUNT') {
      if (dto.discountPercent == null || dto.minimumOrderValue == null) {
        throw new BadRequestException(
          'Discount percentage and minimum order value are required.',
        );
      }
    }
    if (dto.offerType === 'SPECIAL_OFFER' && !dto.offerDescription) {
      throw new BadRequestException('Offer description is required.');
    }
    if (dto.offerType === 'CUSTOM_MESSAGE' && !dto.message) {
      throw new BadRequestException('Message is required.');
    }

    const message =
      dto.offerType === 'CUSTOM_MESSAGE'
        ? this.interpolateTemplate(dto.message || '', vars, expiresAt)
        : this.buildTemplatedMessage(dto, vars, expiresAt);

    return {
      title,
      message,
      couponCode: dto.couponCode?.trim() || null,
      discountPercent: dto.discountPercent ?? null,
      minimumOrderValue: dto.minimumOrderValue ?? null,
      expiresAt,
    };
  }

  private buildTemplatedMessage(
    dto: SendLoyaltyWhatsappDto,
    vars: { customerName: string; restaurantName: string },
    expiresAt: Date | null,
  ) {
    const expiryLine = expiresAt
      ? `\nValid until: ${expiresAt.toLocaleDateString('en-IN')}.`
      : '';

    if (dto.offerType === 'COUPON') {
      return `Hi ${vars.customerName}\n\n${dto.offerDescription}\nUse coupon code: ${dto.couponCode}${expiryLine}\n\nThank you for choosing ${vars.restaurantName}!`;
    }
    if (dto.offerType === 'DISCOUNT') {
      return `Hi ${vars.customerName}\n\nEnjoy ${dto.discountPercent}% OFF on your next order at ${vars.restaurantName}.\nMinimum order value: Rs ${dto.minimumOrderValue}.${expiryLine}\n\nThank you for choosing ${vars.restaurantName}!`;
    }
    return `Hi ${vars.customerName}\n\n${dto.offerDescription}${expiryLine}\n\nThank you for choosing ${vars.restaurantName}!`;
  }

  private interpolateTemplate(
    message: string,
    vars: { customerName: string; restaurantName: string },
    expiresAt: Date | null,
  ) {
    const interpolated = message
      .replace(/\{\{\s*customerName\s*\}\}/g, vars.customerName)
      .replace(/\{\{\s*restaurantName\s*\}\}/g, vars.restaurantName)
      .replace(
        /\{\{\s*expiryDate\s*\}\}/g,
        expiresAt ? expiresAt.toLocaleDateString('en-IN') : '',
      );
    if (!interpolated.trim()) {
      throw new BadRequestException('Message is required.');
    }
    return interpolated.trim();
  }

  private toCustomerListItem(row: {
    id: string;
    name: string;
    phone: string;
    whatsappPhone: string;
    email: string | null;
    notes: string | null;
    marketingConsent: boolean;
    status: LoyaltyCustomerStatus;
    totalOffersSent: number;
    lastOfferSentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      whatsappPhone: row.whatsappPhone,
      email: row.email || '',
      notes: row.notes || '',
      marketingConsent: row.marketingConsent,
      whatsappStatus: row.marketingConsent ? 'OPTED_IN' : 'OPTED_OUT',
      status: row.status,
      totalOffersSent: row.totalOffersSent,
      lastOfferSentAt: row.lastOfferSentAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toCustomerDetail(
    customer: {
      id: string;
      name: string;
      phone: string;
      whatsappPhone: string;
      email?: string | null;
      notes?: string | null;
      marketingConsent: boolean;
      status: LoyaltyCustomerStatus;
      totalOffersSent: number;
      lastOfferSentAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      createdByUserId?: string | null;
      createdBy?: { id: string; name: string; email: string; role: string } | null;
    },
    offers: Array<{
      id: string;
      offerType: LoyaltyOfferType;
      title: string | null;
      message: string;
      couponCode: string | null;
      discountPercent: unknown;
      minimumOrderValue: unknown;
      expiresAt: Date | null;
      providerMessageId: string | null;
      status: LoyaltyOfferStatus;
      sentAt: Date | null;
      failureReason?: string | null;
      createdAt: Date;
      sentBy?: { id: string; name: string; email: string; role: string } | null;
    }>,
  ) {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      whatsappPhone: customer.whatsappPhone,
      email: customer.email || '',
      notes: customer.notes || '',
      marketingConsent: customer.marketingConsent,
      whatsappStatus: customer.marketingConsent ? 'OPTED_IN' : 'OPTED_OUT',
      status: customer.status,
      totalOffersSent: customer.totalOffersSent,
      lastOfferSentAt: customer.lastOfferSentAt?.toISOString() || null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      createdBy: customer.createdBy
        ? {
            id: customer.createdBy.id,
            name: customer.createdBy.name,
            email: customer.createdBy.email,
            role: customer.createdBy.role,
          }
        : null,
      offers: offers.map((offer) => ({
        id: offer.id,
        offerType: offer.offerType,
        title: offer.title || '',
        message: offer.message,
        couponCode: offer.couponCode || '',
        discountPercent:
          offer.discountPercent != null ? Number(offer.discountPercent) : null,
        minimumOrderValue:
          offer.minimumOrderValue != null
            ? Number(offer.minimumOrderValue)
            : null,
        expiresAt: offer.expiresAt?.toISOString() || null,
        providerMessageId: offer.providerMessageId || '',
        status: offer.status,
        sentAt: offer.sentAt?.toISOString() || null,
        failureReason: offer.failureReason || '',
        createdAt: offer.createdAt.toISOString(),
        sentBy: offer.sentBy
          ? {
              id: offer.sentBy.id,
              name: offer.sentBy.name,
              email: offer.sentBy.email,
              role: offer.sentBy.role,
            }
          : null,
      })),
    };
  }
}
