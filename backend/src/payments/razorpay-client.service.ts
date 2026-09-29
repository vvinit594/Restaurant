import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

@Injectable()
export class RazorpayClientService {
  private readonly logger = new Logger(RazorpayClientService.name);
  private client: any | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('RAZORPAY_KEY_ID')?.trim() &&
        this.config.get<string>('RAZORPAY_KEY_SECRET')?.trim(),
    );
  }

  getKeyId(): string {
    return String(this.config.get<string>('RAZORPAY_KEY_ID') || '').trim();
  }

  getWebhookSecret(): string {
    return String(this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') || '').trim();
  }

  getInstance() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    if (!this.client) {
      this.client = new Razorpay({
        key_id: this.getKeyId(),
        key_secret: String(this.config.get<string>('RAZORPAY_KEY_SECRET') || '').trim(),
      });
      this.logger.log('Razorpay client initialized (test/live based on key prefix).');
    }
    return this.client;
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = this.getWebhookSecret();
    if (!secret) return false;
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(String(signature || '')),
      );
    } catch {
      return false;
    }
  }

  async createCustomer(input: {
    name: string;
    email: string;
    contact?: string;
    notes?: Record<string, string>;
  }) {
    const rzp = this.getInstance();
    return rzp.customers.create({
      name: input.name,
      email: input.email,
      contact: input.contact || undefined,
      notes: input.notes || {},
      fail_existing: '0',
    });
  }

  async createSubscription(input: {
    planId: string;
    customerId: string;
    totalCount: number;
    notes?: Record<string, string>;
  }) {
    const rzp = this.getInstance();
    return rzp.subscriptions.create({
      plan_id: input.planId,
      customer_id: input.customerId,
      total_count: input.totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: input.notes || {},
    });
  }

  async fetchPlan(planId: string) {
    const rzp = this.getInstance();
    return rzp.plans.fetch(planId);
  }

  async fetchSubscription(subscriptionId: string) {
    const rzp = this.getInstance();
    return rzp.subscriptions.fetch(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd = false) {
    const rzp = this.getInstance();
    return rzp.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
  }
}
