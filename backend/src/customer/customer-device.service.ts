import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateDeviceCredentials,
  hashDeviceSecret,
  isLikelyDevicePublicId,
  isLikelyDeviceSecret,
  secretsMatch,
} from './device-secret';

export type CustomerDeviceIdentity = {
  customerId: string;
  deviceId: string;
  publicId: string;
};

@Injectable()
export class CustomerDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: {
    publicId?: string;
    secret?: string;
    userAgent?: string;
  }) {
    const publicId = String(input.publicId || '').trim();
    const secret = String(input.secret || '').trim();

    if (publicId && secret) {
      if (!isLikelyDevicePublicId(publicId) || !isLikelyDeviceSecret(secret)) {
        throw new UnauthorizedException('Invalid device credentials.');
      }
      const existing = await this.prisma.customerDevice.findUnique({
        where: { publicId },
        select: { id: true, customerId: true, secretHash: true },
      });
      if (existing) {
        if (!secretsMatch(secret, existing.secretHash)) {
          throw new UnauthorizedException('Invalid device credentials.');
        }
        await this.prisma.customerDevice.update({
          where: { id: existing.id },
          data: {
            lastSeenAt: new Date(),
            userAgent: input.userAgent?.slice(0, 300) || undefined,
          },
        });
        return {
          publicId,
          secret,
          customerId: existing.customerId,
          deviceId: existing.id,
        };
      }

      const customer = await this.prisma.customer.create({ data: {} });
      const device = await this.prisma.customerDevice.create({
        data: {
          customerId: customer.id,
          publicId,
          secretHash: hashDeviceSecret(secret),
          userAgent: input.userAgent?.slice(0, 300) || null,
        },
      });
      return {
        publicId,
        secret,
        customerId: customer.id,
        deviceId: device.id,
      };
    }

    const minted = generateDeviceCredentials();
    const customer = await this.prisma.customer.create({ data: {} });
    const device = await this.prisma.customerDevice.create({
      data: {
        customerId: customer.id,
        publicId: minted.publicId,
        secretHash: hashDeviceSecret(minted.secret),
        userAgent: input.userAgent?.slice(0, 300) || null,
      },
    });
    return {
      publicId: minted.publicId,
      secret: minted.secret,
      customerId: customer.id,
      deviceId: device.id,
    };
  }

  async resolveFromRequest(req: Request): Promise<CustomerDeviceIdentity> {
    const identity = await this.resolveOptionalFromRequest(req);
    if (!identity) {
      throw new UnauthorizedException('Customer device registration required.');
    }
    return identity;
  }

  async resolveOptionalFromRequest(
    req: Request,
  ): Promise<CustomerDeviceIdentity | null> {
    const publicId = String(req.headers['x-device-id'] || '').trim();
    const secret = String(req.headers['x-device-secret'] || '').trim();
    if (!publicId || !secret) return null;
    if (!isLikelyDevicePublicId(publicId) || !isLikelyDeviceSecret(secret)) {
      return null;
    }

    const device = await this.prisma.customerDevice.findUnique({
      where: { publicId },
      select: { id: true, customerId: true, publicId: true, secretHash: true },
    });
    if (!device || !secretsMatch(secret, device.secretHash)) return null;

    await this.prisma.customerDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      customerId: device.customerId,
      deviceId: device.id,
      publicId: device.publicId,
    };
  }
}
