import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QrCodeStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

type Tx = Prisma.TransactionClient;

function isLocalHost(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

@Injectable()
export class QrService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Customer SPA origin for QR payloads.
   * On Vercel, never fall back to localhost — prefer PUBLIC_WEB_URL, then a
   * non-local FRONTEND_ORIGIN entry.
   */
  getPublicWebUrl() {
    const publicWeb = String(this.config.get<string>('PUBLIC_WEB_URL') || '').trim();
    const origins = String(this.config.get<string>('FRONTEND_ORIGIN') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const onVercel = Boolean(process.env.VERCEL);
    let base = publicWeb;

    if (!base || (onVercel && isLocalHost(base))) {
      base =
        origins.find((o) => !isLocalHost(o)) ||
        origins[0] ||
        (onVercel ? '' : 'http://localhost:3000');
    }

    if (!base) {
      console.error(
        'PUBLIC_WEB_URL is missing. Set it to your public frontend origin (no trailing slash).',
      );
      base = 'http://localhost:3000';
    }

    return base.replace(/\/+$/, '');
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

  /**
   * Always rebuild targetUrl from current PUBLIC_WEB_URL so production never
   * serves stale localhost URLs stored in the DB.
   */
  toPublicQr(
    qr: {
      id: string;
      token: string;
      targetUrl: string;
      status: QrCodeStatus;
      createdAt: Date;
      updatedAt: Date;
      restaurantId: string;
    },
    slug?: string,
  ) {
    const resolvedSlug =
      slug || this.slugFromTarget(qr.targetUrl) || 'restaurant';
    const targetUrl = this.buildTargetUrl(resolvedSlug, qr.token);

    return {
      id: qr.id,
      restaurantId: qr.restaurantId,
      token: qr.token,
      targetUrl,
      status: qr.status.toLowerCase(),
      path: `/r/${resolvedSlug}/t/${qr.token}`,
      createdAt: qr.createdAt.toISOString(),
      updatedAt: qr.updatedAt.toISOString(),
    };
  }

  /** Persist corrected targetUrl when DB still has localhost / wrong host. */
  needsTargetUrlRewrite(storedUrl: string, slug: string, token: string) {
    const correct = this.buildTargetUrl(slug, token);
    return storedUrl !== correct;
  }

  private slugFromTarget(targetUrl: string) {
    try {
      const u = new URL(targetUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'r' && parts[1]) return parts[1];
    } catch {
      /* ignore */
    }
    return null;
  }
}
