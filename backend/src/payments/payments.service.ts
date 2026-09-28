import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommissionRuleType,
  CommissionStatus,
  PaymentStatus,
  Prisma,
  RestaurantStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { auditLog } from '../common/audit-log';
import {
  addGraceHours,
  computeSubscriptionEndsAt,
  getPlanConfig,
  getRazorpayPlanIdFromEnv,
  isPaymentRequiredForPlan,
} from '../common/subscription-plans';
import { PrismaService } from '../prisma/prisma.service';
import { parseMonthlyPriceLabel } from '../sales/sales.utils';
import { RazorpayClientService } from './razorpay-client.service';

const GRACE_HOURS = 24;
const MONTHLY_TOTAL_COUNT = 120;
const LAUNCH_TOTAL_COUNT = 40;

/** Razorpay rejects some local phone formats. Omit a contact it would refuse. */
function razorpayContact(raw?: string | null): string | undefined {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length < 8 || digits.length > 15) return undefined;
  return digits;
}

function razorpayFailureMessage(err: unknown): string {
  const e = err as {
    error?: { description?: string };
    description?: string;
    message?: string;
    getResponse?: () => unknown;
  };
  if (typeof e?.getResponse === 'function') {
    const body = e.getResponse();
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: string | string[] }).message;
      if (Array.isArray(message)) return message.join(', ');
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  return (
    e?.error?.description ||
    e?.description ||
    (typeof e?.message === 'string' && e.message.trim()) ||
    'Razorpay request failed.'
  );
}

function unixToDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  try {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  } catch {
    return null;
  }
}

function isRazorpaySubscriptionPaidActive(status: unknown): boolean {
  const st = String(status || '').toLowerCase();
  return st === 'active' || st === 'authenticated';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly razorpay: RazorpayClientService,
  ) {}

  getPublicKeyId() {
    return {
      keyId: this.razorpay.getKeyId(),
      configured: this.razorpay.isConfigured(),
    };
  }

  /**
   * After restaurant+subscription rows exist, create Razorpay customer+subscription
   * and return Checkout payload. Trial plans skip Razorpay.
   */
  async startPaidCheckout(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        restaurant: {
          include: {
            memberships: {
              where: { isActive: true },
              take: 1,
              include: { user: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('Subscription not found.');

    const planCode = sub.plan.code;
    if (!isPaymentRequiredForPlan(planCode)) {
      throw new BadRequestException('This plan does not require payment.');
    }

    if (!this.razorpay.isConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Cannot start paid subscription checkout.',
      );
    }

    const razorpayPlanId = getRazorpayPlanIdFromEnv(planCode, {
      RAZORPAY_MONTHLY_PLAN_ID: this.config.get<string>('RAZORPAY_MONTHLY_PLAN_ID'),
      RAZORPAY_LAUNCH_PLAN_ID: this.config.get<string>('RAZORPAY_LAUNCH_PLAN_ID'),
    });
    if (!razorpayPlanId) {
      throw new ServiceUnavailableException(
        `Razorpay plan ID missing for ${planCode}. Set RAZORPAY_MONTHLY_PLAN_ID / RAZORPAY_LAUNCH_PLAN_ID.`,
      );
    }

    const owner = sub.restaurant.memberships[0]?.user;
    const customerName = owner?.name || sub.restaurant.name;
    const customerEmail = owner?.email || sub.restaurant.email;
    const customerContact = razorpayContact(owner?.phone || sub.restaurant.phone);

    let customerId = sub.razorpayCustomerId || '';
    if (!customerId) {
      let customer;
      try {
        customer = await this.razorpay.createCustomer({
          name: customerName,
          email: customerEmail,
          contact: customerContact,
          notes: {
            restaurantId: sub.restaurantId,
            subscriptionId: sub.id,
            planCode,
          },
        });
      } catch (err) {
        throw new ServiceUnavailableException(
          `Razorpay customer could not be created. ${razorpayFailureMessage(err)}`,
        );
      }
      customerId = String(customer.id);
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { razorpayCustomerId: customerId, razorpayPlanId },
      });
    }

    let rzpSubId = sub.razorpaySubscriptionId || '';
    let shortUrl: string | null = null;
    if (!rzpSubId) {
      const totalCount =
        planCode === 'LAUNCH' ? LAUNCH_TOTAL_COUNT : MONTHLY_TOTAL_COUNT;
      let created;
      try {
        created = await this.razorpay.createSubscription({
          planId: razorpayPlanId,
          customerId,
          totalCount,
          notes: {
            restaurantId: sub.restaurantId,
            subscriptionId: sub.id,
            planCode,
            dilYumPlan: planCode,
          },
        });
      } catch (err) {
        throw new ServiceUnavailableException(
          `Razorpay subscription could not be created. ${razorpayFailureMessage(err)}`,
        );
      }
      rzpSubId = String(created.id);
      shortUrl = created.short_url || null;
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          razorpayCustomerId: customerId,
          razorpaySubscriptionId: rzpSubId,
          razorpayPlanId,
        },
      });
    } else {
      try {
        const fetched = await this.razorpay.fetchSubscription(rzpSubId);
        shortUrl = fetched.short_url || null;
        if (isRazorpaySubscriptionPaidActive(fetched?.status)) {
          await this.activateLocalSubscription(sub, fetched);
          throw new BadRequestException(
            'Subscription is already active. Refresh the restaurant profile.',
          );
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        /* ignore fetch failures and continue checkout */
      }
    }

    const planConfig = getPlanConfig(planCode);
    const amountPaise = Math.round(Number(sub.plan.priceAmount) * 100);

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        razorpayCustomerId: customerId,
        razorpaySubscriptionId: rzpSubId,
        razorpayPlanId,
        status: SubscriptionStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    return {
      keyId: this.razorpay.getKeyId(),
      subscriptionId: rzpSubId,
      dilYumSubscriptionId: sub.id,
      restaurantId: sub.restaurantId,
      planCode,
      planName: sub.plan.name,
      amount: Number(sub.plan.priceAmount),
      amountPaise,
      currency: 'INR',
      shortUrl,
      customer: {
        name: customerName,
        email: customerEmail,
        contact: customerContact || '',
      },
      description: `${sub.plan.name} — DilYum`,
      billingMonths: planConfig?.billingMonths || sub.plan.billingMonths,
      paymentRequired: true,
    };
  }

  async getRestaurantBilling(restaurantId: string) {
    await this.syncFromRazorpayIfNeeded(restaurantId);

    const sub = await this.prisma.subscription.findFirst({
      where: {
        restaurantId,
        status: {
          in: [
            SubscriptionStatus.PENDING,
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.SUSPENDED,
          ],
        },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, status: true },
    });

    const payments = await this.prisma.payment.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (!sub) {
      return {
        restaurant,
        subscription: null,
        payments: payments.map((p) => this.toPaymentDto(p)),
        checkoutAvailable: false,
      };
    }

    const now = new Date();
    const graceEnd = sub.gracePeriodEndsAt;
    const graceRemainingMs =
      graceEnd && !Number.isNaN(graceEnd.getTime())
        ? Math.max(0, graceEnd.getTime() - now.getTime())
        : null;

    return {
      restaurant,
      subscription: {
        id: sub.id,
        planCode: sub.plan.code,
        planName: sub.plan.name,
        priceLabel: sub.plan.priceLabel,
        priceAmount: Number(sub.plan.priceAmount),
        billingMonths: sub.plan.billingMonths,
        billingDays: sub.plan.billingDays,
        planType: sub.plan.planType,
        status: sub.status,
        paymentStatus: sub.paymentStatus,
        startedAt: safeIso(sub.startedAt) || new Date().toISOString(),
        endsAt: safeIso(sub.endsAt),
        lastPaymentAt: safeIso(sub.lastPaymentAt),
        nextPaymentAt: safeIso(sub.nextPaymentAt),
        paymentFailedAt: safeIso(sub.paymentFailedAt),
        gracePeriodEndsAt: safeIso(sub.gracePeriodEndsAt),
        graceRemainingHours:
          graceRemainingMs != null
            ? Math.ceil(graceRemainingMs / (1000 * 60 * 60))
            : null,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        paymentRequired: isPaymentRequiredForPlan(sub.plan.code),
      },
      payments: payments.map((p) => this.toPaymentDto(p)),
      checkoutAvailable:
        isPaymentRequiredForPlan(sub.plan.code) &&
        (sub.status === SubscriptionStatus.PENDING ||
          sub.status === SubscriptionStatus.PAST_DUE ||
          sub.status === SubscriptionStatus.SUSPENDED ||
          sub.paymentStatus === PaymentStatus.FAILED),
    };
  }

  async retryCheckout(restaurantId: string) {
    await this.syncFromRazorpayIfNeeded(restaurantId);

    const active = await this.prisma.subscription.findFirst({
      where: {
        restaurantId,
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (active) {
      throw new BadRequestException(
        'Subscription is already active. Refresh the restaurant profile.',
      );
    }

    const sub = await this.prisma.subscription.findFirst({
      where: {
        restaurantId,
        status: {
          in: [
            SubscriptionStatus.PENDING,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.SUSPENDED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) {
      throw new BadRequestException(
        'No payable subscription found for this restaurant.',
      );
    }
    return this.startPaidCheckout(sub.id);
  }

  async listPaymentsForAdmin(restaurantId: string) {
    return this.getRestaurantBilling(restaurantId);
  }

  /**
   * Idempotent webhook processor. Caller must verify signature first.
   */
  async processWebhookEvent(event: {
    id?: string;
    event: string;
    payload: any;
    created_at?: number;
  }) {
    const eventId = String(event.id || '').trim();
    const eventType = String(event.event || '').trim();
    if (!eventId || !eventType) {
      throw new BadRequestException('Invalid Razorpay webhook payload.');
    }

    const existing = await this.prisma.razorpayWebhookEvent.findUnique({
      where: { eventId },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    try {
      await this.prisma.razorpayWebhookEvent.create({
        data: {
          eventId,
          eventType,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return { ok: true, duplicate: true };
      }
      throw err;
    }

    try {
      await this.dispatchEvent(eventType, event.payload);
    } catch (err) {
      await this.prisma.razorpayWebhookEvent
        .delete({ where: { eventId } })
        .catch(() => undefined);
      throw err;
    }

    auditLog('RAZORPAY_WEBHOOK_PROCESSED', { eventId, eventType });
    return { ok: true, duplicate: false };
  }

  private async dispatchEvent(eventType: string, payload: any) {
    switch (eventType) {
      case 'subscription.authenticated':
      case 'subscription.activated':
        await this.onSubscriptionActivated(payload);
        break;
      case 'subscription.charged':
      case 'invoice.paid':
        await this.onPaymentSuccess(payload);
        break;
      case 'subscription.halted':
      case 'subscription.cancelled':
      case 'subscription.completed':
        await this.onSubscriptionEnded(payload, eventType);
        break;
      // subscription.pending uses the same 24h grace path as payment.failed.
      case 'payment.failed':
      case 'subscription.pending':
        await this.onPaymentFailed(payload);
        break;
      default:
        this.logger.debug(`Unhandled Razorpay event: ${eventType}`);
    }
  }

  private async findSubscriptionFromPayload(payload: any) {
    const inner = payload?.payload || payload;
    const subscriptionEntity =
      inner?.subscription?.entity ||
      inner?.subscription ||
      payload?.subscription?.entity ||
      payload?.subscription;
    const paymentEntity =
      inner?.payment?.entity || inner?.payment || payload?.payment;
    const invoiceEntity =
      inner?.invoice?.entity || inner?.invoice || payload?.invoice;

    const rzpSubId =
      subscriptionEntity?.id ||
      paymentEntity?.subscription_id ||
      invoiceEntity?.subscription_id ||
      null;

    const notes =
      subscriptionEntity?.notes ||
      paymentEntity?.notes ||
      invoiceEntity?.notes ||
      {};

    if (rzpSubId) {
      const byRzp = await this.prisma.subscription.findFirst({
        where: { razorpaySubscriptionId: String(rzpSubId) },
        include: { plan: true, restaurant: true },
      });
      if (byRzp) return { sub: byRzp, paymentEntity, subscriptionEntity, invoiceEntity };
    }

    const dilYumSubId = notes?.subscriptionId || notes?.dilYumSubscriptionId;
    if (dilYumSubId) {
      const byId = await this.prisma.subscription.findUnique({
        where: { id: String(dilYumSubId) },
        include: { plan: true, restaurant: true },
      });
      if (byId) return { sub: byId, paymentEntity, subscriptionEntity, invoiceEntity };
    }

    return null;
  }

  /**
   * If DilYum is still PENDING/PAST_DUE/SUSPENDED but Razorpay already has
   * an active/authenticated subscription, copy that state into the database.
   * Never throws — profile/billing reads must stay HTTP 200.
   */
  async syncFromRazorpayIfNeeded(restaurantId: string): Promise<void> {
    try {
      const sub = await this.prisma.subscription.findFirst({
        where: {
          restaurantId,
          razorpaySubscriptionId: { not: null },
          status: {
            in: [
              SubscriptionStatus.PENDING,
              SubscriptionStatus.PAST_DUE,
              SubscriptionStatus.SUSPENDED,
            ],
          },
        },
        include: { plan: true, restaurant: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub?.razorpaySubscriptionId || !this.razorpay.isConfigured()) {
        return;
      }

      const rzp = await this.razorpay.fetchSubscription(
        sub.razorpaySubscriptionId,
      );
      if (!isRazorpaySubscriptionPaidActive(rzp?.status)) {
        return;
      }
      await this.activateLocalSubscription(sub, rzp);
    } catch (err: any) {
      this.logger.warn(
        `Razorpay subscription sync skipped for ${restaurantId}: ${
          err?.message || err
        }`,
      );
    }
  }

  private async activateLocalSubscription(
    sub: {
      id: string;
      restaurantId: string;
      razorpaySubscriptionId: string | null;
      razorpayCustomerId: string | null;
      plan: { billingDays?: number | null; billingMonths?: number | null };
      restaurant: { status: RestaurantStatus };
    },
    rzpSub?: any,
  ) {
    const now = new Date();
    const startedAt =
      unixToDate(rzpSub?.current_start) || unixToDate(rzpSub?.start_at) || now;
    const endsAt =
      unixToDate(rzpSub?.current_end) ||
      unixToDate(rzpSub?.end_at) ||
      computeSubscriptionEndsAt(startedAt, sub.plan);
    const nextPaymentAt = unixToDate(rzpSub?.charge_at) || endsAt;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
        startedAt,
        endsAt,
        nextPaymentAt,
        razorpaySubscriptionId: rzpSub?.id || sub.razorpaySubscriptionId,
        razorpayCustomerId: rzpSub?.customer_id || sub.razorpayCustomerId,
        paymentFailedAt: null,
        gracePeriodStartedAt: null,
        gracePeriodEndsAt: null,
      },
    });

    if (sub.restaurant.status === RestaurantStatus.SUSPENDED) {
      await this.prisma.restaurant.update({
        where: { id: sub.restaurantId },
        data: { status: RestaurantStatus.ACTIVE },
      });
    }
  }

  private async onSubscriptionActivated(payload: any) {
    const found = await this.findSubscriptionFromPayload(payload);
    if (!found) return;
    const { sub, subscriptionEntity } = found;
    await this.activateLocalSubscription(sub, subscriptionEntity);
  }

  private async onPaymentSuccess(payload: any) {
    const found = await this.findSubscriptionFromPayload(payload);
    if (!found) return;
    const { sub, paymentEntity, subscriptionEntity, invoiceEntity } = found;

    const rzpPaymentId =
      paymentEntity?.id ||
      invoiceEntity?.payment_id ||
      null;
    const amountPaise =
      paymentEntity?.amount ??
      invoiceEntity?.amount_paid ??
      Math.round(Number(sub.plan.priceAmount) * 100);
    const amount = Number(amountPaise) / 100;
    const method = paymentEntity?.method || null;
    const paidAt =
      unixToDate(paymentEntity?.created_at) ||
      unixToDate(invoiceEntity?.date) ||
      new Date();

    if (rzpPaymentId) {
      const existingPay = await this.prisma.payment.findUnique({
        where: { razorpayPaymentId: String(rzpPaymentId) },
      });
      if (!existingPay) {
        await this.prisma.payment.create({
          data: {
            restaurantId: sub.restaurantId,
            subscriptionId: sub.id,
            razorpayPaymentId: String(rzpPaymentId),
            razorpaySubscriptionId:
              sub.razorpaySubscriptionId ||
              subscriptionEntity?.id ||
              null,
            planCode: sub.plan.code,
            amount: new Prisma.Decimal(amount),
            currency: 'INR',
            status: PaymentStatus.PAID,
            method,
            paidAt,
            rawPayload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    const endsAt = computeSubscriptionEndsAt(paidAt, sub.plan);
    const nextPaymentAt = unixToDate(subscriptionEntity?.charge_at) || endsAt;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
        lastPaymentAt: paidAt,
        endsAt,
        nextPaymentAt,
        razorpayPaymentId: rzpPaymentId
          ? String(rzpPaymentId)
          : sub.razorpayPaymentId,
        paymentFailedAt: null,
        gracePeriodStartedAt: null,
        gracePeriodEndsAt: null,
      },
    });

    if (sub.restaurant.status === RestaurantStatus.SUSPENDED) {
      await this.prisma.restaurant.update({
        where: { id: sub.restaurantId },
        data: { status: RestaurantStatus.ACTIVE },
      });
    }

    // Commission only after paid confirmation (sales-attributed restaurants).
    if (sub.restaurant.salesPersonId && amount > 0) {
      await this.ensurePaidCommission({
        salesPersonId: sub.restaurant.salesPersonId,
        restaurantId: sub.restaurantId,
        subscriptionId: sub.id,
        planCode: sub.plan.code,
        priceLabel: sub.plan.priceLabel,
        priceAmount: amount,
      });
    }
  }

  /** Idempotent commission on paid subscription (avoids SalesModule circular import). */
  private async ensurePaidCommission(input: {
    salesPersonId: string;
    restaurantId: string;
    subscriptionId: string;
    planCode: string;
    priceLabel?: string | null;
    priceAmount: number;
  }) {
    if (input.planCode === 'TRIAL_10_DAYS' || input.priceAmount <= 0) return;
    const existing = await this.prisma.commission.findUnique({
      where: { subscriptionId: input.subscriptionId },
    });
    if (existing) return;

    const rule = await this.prisma.commissionRule.findFirst({
      where: { planCode: input.planCode.toUpperCase(), isActive: true },
    });
    if (!rule) return;

    let amount = Number(rule.value);
    if (rule.type === CommissionRuleType.PERCENT) {
      const base = parseMonthlyPriceLabel(input.priceLabel, input.priceAmount);
      amount = Math.round(((base * Number(rule.value)) / 100) * 100) / 100;
    } else {
      amount = Math.round(Number(rule.value) * 100) / 100;
    }

    try {
      await this.prisma.commission.create({
        data: {
          salesPersonId: input.salesPersonId,
          restaurantId: input.restaurantId,
          subscriptionId: input.subscriptionId,
          planCode: input.planCode.toUpperCase(),
          amount: new Prisma.Decimal(amount),
          status: CommissionStatus.PENDING,
        },
      });
      auditLog('COMMISSION_CREATED', {
        salesPersonId: input.salesPersonId,
        restaurantId: input.restaurantId,
        subscriptionId: input.subscriptionId,
        amount,
        source: 'razorpay_payment',
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }
  }

  private async onPaymentFailed(payload: any) {
    const found = await this.findSubscriptionFromPayload(payload);
    if (!found) return;
    const { sub, paymentEntity, invoiceEntity } = found;

    const now = new Date();
    const alreadyInGrace =
      sub.status === SubscriptionStatus.PAST_DUE &&
      sub.gracePeriodEndsAt &&
      sub.gracePeriodEndsAt > now;

    const graceStart = alreadyInGrace
      ? sub.gracePeriodStartedAt || now
      : now;
    const graceEnd = alreadyInGrace
      ? sub.gracePeriodEndsAt!
      : addGraceHours(now, GRACE_HOURS);

    const rzpPaymentId = paymentEntity?.id || null;
    const amountPaise =
      paymentEntity?.amount ??
      invoiceEntity?.amount_due ??
      Math.round(Number(sub.plan.priceAmount) * 100);
    const failureReason =
      paymentEntity?.error_description ||
      paymentEntity?.error_reason ||
      'Payment failed';

    if (rzpPaymentId) {
      const existingPay = await this.prisma.payment.findUnique({
        where: { razorpayPaymentId: String(rzpPaymentId) },
      });
      if (!existingPay) {
        await this.prisma.payment.create({
          data: {
            restaurantId: sub.restaurantId,
            subscriptionId: sub.id,
            razorpayPaymentId: String(rzpPaymentId),
            razorpaySubscriptionId: sub.razorpaySubscriptionId,
            planCode: sub.plan.code,
            amount: new Prisma.Decimal(Number(amountPaise) / 100),
            currency: 'INR',
            status: PaymentStatus.FAILED,
            method: paymentEntity?.method || null,
            failureReason: String(failureReason),
            rawPayload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    // Do not suspend immediately — enter 24h grace.
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        paymentStatus: PaymentStatus.FAILED,
        paymentFailedAt: now,
        gracePeriodStartedAt: graceStart,
        gracePeriodEndsAt: graceEnd,
      },
    });
  }

  private async onSubscriptionEnded(payload: any, eventType: string) {
    const found = await this.findSubscriptionFromPayload(payload);
    if (!found) return;
    const { sub } = found;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status:
          eventType.includes('cancel') || eventType.includes('halted')
            ? SubscriptionStatus.CANCELLED
            : SubscriptionStatus.SUSPENDED,
      },
    });
  }

  /** Hourly: suspend restaurants whose grace period expired unpaid. */
  async suspendExpiredGracePeriods() {
    const now = new Date();
    const overdue = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        gracePeriodEndsAt: { lt: now },
        paymentStatus: { not: PaymentStatus.PAID },
      },
      select: { id: true, restaurantId: true },
    });

    let suspended = 0;
    for (const row of overdue) {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: row.id },
          data: { status: SubscriptionStatus.SUSPENDED },
        }),
        this.prisma.restaurant.update({
          where: { id: row.restaurantId },
          data: { status: RestaurantStatus.SUSPENDED },
        }),
      ]);
      suspended += 1;
      auditLog('RESTAURANT_SUSPENDED_PAYMENT_OVERDUE', {
        restaurantId: row.restaurantId,
        subscriptionId: row.id,
      });
    }

    if (suspended > 0) {
      this.logger.warn(`Suspended ${suspended} restaurant(s) after grace period.`);
    }
    return { suspended };
  }

  private toPaymentDto(p: {
    id: string;
    planCode: string;
    amount: unknown;
    currency: string;
    status: PaymentStatus;
    method: string | null;
    failureReason: string | null;
    paidAt: Date | null;
    razorpayPaymentId: string | null;
    createdAt: Date;
  }) {
    return {
      id: p.id,
      planCode: p.planCode,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      method: p.method,
      failureReason: p.failureReason,
      paidAt: safeIso(p.paidAt),
      razorpayPaymentId: p.razorpayPaymentId,
      createdAt: safeIso(p.createdAt) || new Date().toISOString(),
    };
  }
}
