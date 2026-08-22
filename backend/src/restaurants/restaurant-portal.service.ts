import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  QrCodeStatus,
  RestaurantStatus,
} from '@prisma/client';
import { auditLog } from '../common/audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantContextService } from './restaurant-context.service';
import { UpdateRestaurantProfileDto } from './dto/update-restaurant-profile.dto';

@Injectable()
export class RestaurantPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantContext: RestaurantContextService,
  ) {}

  async getProfile(user: { id: string; role: any; restaurantId?: string }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: ctx.restaurantId, deletedAt: null },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found.');
    return this.toProfile(restaurant);
  }

  async updateProfile(
    user: { id: string; role: any; restaurantId?: string },
    dto: UpdateRestaurantProfileDto,
  ) {
    const ctx = await this.restaurantContext.requireActiveMembership(user, [
      MembershipRole.RESTAURANT_OWNER,
    ]);

    const existing = await this.prisma.restaurant.findFirst({
      where: { id: ctx.restaurantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Restaurant not found.');

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const clash = await this.prisma.restaurant.findFirst({
        where: {
          email,
          deletedAt: null,
          NOT: { id: ctx.restaurantId },
        },
      });
      if (clash) {
        throw new BadRequestException(
          'Another restaurant already uses this email.',
        );
      }
    }

    const updated = await this.prisma.restaurant.update({
      where: { id: ctx.restaurantId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
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
        ...(dto.logoUrl !== undefined
          ? { logoUrl: dto.logoUrl?.trim() || null }
          : {}),
        ...(dto.coverImageUrl !== undefined || dto.coverUrl !== undefined
          ? {
              coverImageUrl:
                (dto.coverImageUrl ?? dto.coverUrl)?.trim() || null,
            }
          : {}),
      },
    });

    auditLog('RESTAURANT_PROFILE_UPDATED', {
      restaurantId: updated.id,
      userId: user.id,
    });

    return this.toProfile(updated);
  }

  async getDashboardStats(user: {
    id: string;
    role: any;
    restaurantId?: string;
  }) {
    const ctx = await this.restaurantContext.requireActiveMembership(user);

    const [
      totalDishes,
      availableDishes,
      unavailableDishes,
      categories,
      tables,
      activeQrCodes,
    ] = await Promise.all([
      this.prisma.dish.count({
        where: { restaurantId: ctx.restaurantId, deletedAt: null },
      }),
      this.prisma.dish.count({
        where: {
          restaurantId: ctx.restaurantId,
          deletedAt: null,
          isAvailable: true,
        },
      }),
      this.prisma.dish.count({
        where: {
          restaurantId: ctx.restaurantId,
          deletedAt: null,
          isAvailable: false,
        },
      }),
      this.prisma.category.count({
        where: {
          restaurantId: ctx.restaurantId,
          deletedAt: null,
          isActive: true,
        },
      }),
      this.prisma.branch.count({
        where: { restaurantId: ctx.restaurantId },
      }),
      this.prisma.qrCode.count({
        where: {
          restaurantId: ctx.restaurantId,
          status: QrCodeStatus.ACTIVE,
        },
      }),
    ]);

    return {
      totalDishes,
      availableDishes,
      unavailableDishes,
      categories,
      tables,
      activeQrCodes,
      restaurant: {
        id: ctx.restaurantId,
        name: ctx.restaurantName,
        slug: ctx.restaurantSlug,
      },
    };
  }

  private toProfile(r: {
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
  }) {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description || '',
      logoUrl: r.logoUrl || '',
      coverUrl: r.coverImageUrl || '',
      coverImageUrl: r.coverImageUrl || '',
      phone: r.phone,
      email: r.email,
      address: r.address,
      city: r.city,
      state: r.state || '',
      pincode: r.pincode || '',
      status: r.status.toLowerCase(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
