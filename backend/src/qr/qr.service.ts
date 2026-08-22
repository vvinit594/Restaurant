import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QrCodeStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class QrService {
  constructor(private readonly config: ConfigService) {}

  getPublicWebUrl() {
    const raw =
      this.config.get<string>('PUBLIC_WEB_URL') ||
      this.config.get<string>('FRONTEND_ORIGIN') ||
      'http://localhost:3000';
    return String(raw).replace(/\/+$/, '');
  }

  buildTargetUrl(slug: string, token: string) {
    return `${this.getPublicWebUrl()}/r/${slug}/t/${token}#menu`;
  }

  newToken() {
    return randomBytes(16).toString('hex');
  }

  /**
   * Create primary ACTIVE QR inside an existing transaction.
   * Does not create restaurants. Idempotent if ACTIVE QR already exists.
   */
  async createPrimaryInTransaction(
    tx: Tx,
    restaurant: { id: string; slug: string },
  ) {
    const existing = await tx.qrCode.findFirst({
      where: { restaurantId: restaurant.id, status: QrCodeStatus.ACTIVE },
    });
    if (existing) return existing;

    const token = this.newToken();
    return tx.qrCode.create({
      data: {
        restaurantId: restaurant.id,
        token,
        targetUrl: this.buildTargetUrl(restaurant.slug, token),
        status: QrCodeStatus.ACTIVE,
      },
    });
  }

  toPublicQr(qr: {
    id: string;
    token: string;
    targetUrl: string;
    status: QrCodeStatus;
    createdAt: Date;
    updatedAt: Date;
    restaurantId: string;
  }) {
    return {
      id: qr.id,
      restaurantId: qr.restaurantId,
      token: qr.token,
      targetUrl: qr.targetUrl,
      status: qr.status.toLowerCase(),
      path: `/r/${this.slugFromTarget(qr.targetUrl) || 'restaurant'}/t/${qr.token}`,
      createdAt: qr.createdAt.toISOString(),
      updatedAt: qr.updatedAt.toISOString(),
    };
  }

  private slugFromTarget(targetUrl: string) {
    try {
      const u = new URL(targetUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      // /r/{slug}/t/{token}
      if (parts[0] === 'r' && parts[1]) return parts[1];
    } catch {
      /* ignore */
    }
    return null;
  }
}
