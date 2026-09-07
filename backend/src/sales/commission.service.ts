import { Injectable } from '@nestjs/common';
import {
  CommissionRuleType,
  CommissionStatus,
  Prisma,
} from '@prisma/client';
import { auditLog } from '../common/audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { parseMonthlyPriceLabel } from './sales.utils';

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent commission creation for a subscription.
   * Unique on subscriptionId — retries / duplicates are safe.
   */
  async ensureCommissionForSubscription(input: {
    salesPersonId: string;
    restaurantId: string;
    subscriptionId: string;
    planCode: string;
    priceLabel?: string | null;
  }) {
    const existing = await this.prisma.commission.findUnique({
      where: { subscriptionId: input.subscriptionId },
    });
    if (existing) return existing;

    const rule = await this.prisma.commissionRule.findFirst({
      where: {
        planCode: input.planCode.toUpperCase(),
        isActive: true,
      },
    });

    if (!rule) {
      // Rules not configured yet — skip creating a zero/fake commission.
      return null;
    }

    const amount = this.calculateAmount(rule.type, Number(rule.value), input.priceLabel);

    try {
      const created = await this.prisma.commission.create({
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
        commissionId: created.id,
        salesPersonId: input.salesPersonId,
        restaurantId: input.restaurantId,
        subscriptionId: input.subscriptionId,
        amount,
      });

      return created;
    } catch (err) {
      // Race: unique constraint on subscriptionId
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return this.prisma.commission.findUnique({
          where: { subscriptionId: input.subscriptionId },
        });
      }
      throw err;
    }
  }

  calculateAmount(
    type: CommissionRuleType,
    value: number,
    priceLabel?: string | null,
  ): number {
    if (type === CommissionRuleType.PERCENT) {
      const base = parseMonthlyPriceLabel(priceLabel);
      return Math.round(((base * value) / 100) * 100) / 100;
    }
    return Math.round(value * 100) / 100;
  }

  async listRules() {
    return this.prisma.commissionRule.findMany({
      where: { isActive: true },
      orderBy: { planCode: 'asc' },
    });
  }
}
