import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CustomerNotificationType,
  OrderStatus,
} from '@prisma/client';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { orderStatusNotificationCopy } from './customer.service';

@Injectable()
export class CustomerPushService {
  private readonly logger = new Logger(CustomerPushService.name);
  private configured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      this.config.get<string>('VAPID_SUBJECT') || 'mailto:hello@dilyum.live';
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    }
  }

  getPublicConfig() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY') || '';
    return {
      vapidPublicKey: publicKey,
      enabled: this.configured && Boolean(publicKey),
    };
  }

  requireConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Push notifications are not configured on this server.',
      );
    }
  }

  async saveSubscription(
    deviceId: string,
    input: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
  ) {
    this.requireConfigured();
    return this.prisma.customerPushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        deviceId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent?.slice(0, 300) || null,
      },
      update: {
        deviceId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent?.slice(0, 300) || null,
      },
      select: { id: true, endpoint: true },
    });
  }

  async deleteSubscription(deviceId: string, endpoint?: string) {
    if (endpoint) {
      await this.prisma.customerPushSubscription.deleteMany({
        where: { deviceId, endpoint },
      });
    } else {
      await this.prisma.customerPushSubscription.deleteMany({ where: { deviceId } });
    }
    return { ok: true };
  }

  async notifyOrderStatus(params: {
    customerId?: string | null;
    restaurantId: string;
    restaurantName: string;
    orderId: string;
    orderNumber: string;
    status: OrderStatus;
  }) {
    if (!params.customerId) return;
    const copy = orderStatusNotificationCopy(
      params.status,
      params.restaurantName,
      params.orderNumber,
    );
    const notification = await this.prisma.customerNotification.create({
      data: {
        customerId: params.customerId,
        restaurantId: params.restaurantId,
        type: copy.type,
        title: copy.title,
        message: copy.message,
        orderId: params.orderId,
      },
    });
    await this.sendToCustomer(params.customerId, {
      title: copy.title,
      body: copy.message,
      url: '/account/orders/live',
      notificationId: notification.id,
    });
  }

  async sendToCustomer(
    customerId: string,
    payload: {
      title: string;
      body: string;
      url?: string;
      notificationId?: string;
    },
  ): Promise<{ delivered: number; failed: number }> {
    if (!this.configured) return { delivered: 0, failed: 0 };

    const subscriptions = await this.prisma.customerPushSubscription.findMany({
      where: { device: { customerId } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    let delivered = 0;
    let failed = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              url: payload.url || '/account/notifications',
              notificationId: payload.notificationId || null,
            }),
          );
          delivered += 1;
        } catch (err: any) {
          failed += 1;
          const statusCode = Number(err?.statusCode || 0);
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.customerPushSubscription.delete({
              where: { id: sub.id },
            }).catch(() => undefined);
          } else {
            this.logger.warn(
              `Push failed for ${sub.endpoint.slice(0, 48)}: ${err?.message || err}`,
            );
          }
        }
      }),
    );
    return { delivered, failed };
  }
}
