import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  MembershipRole,
  RestaurantStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RestaurantContext = {
  userId: string;
  restaurantId: string;
  membershipRole: MembershipRole;
  restaurantName: string;
  restaurantSlug: string;
  restaurantStatus: RestaurantStatus;
};

const MEMBERSHIP_WITH_RESTAURANT = {
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      deletedAt: true,
    },
  },
} as const;

@Injectable()
export class RestaurantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(
    user: { id: string; role: UserRole; restaurantId?: string },
    allowedRoles?: MembershipRole[],
    opts?: { allowSuspended?: boolean },
  ): Promise<RestaurantContext> {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required.');
    }

    let membership = await this.prisma.restaurantMembership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        ...(user.restaurantId ? { restaurantId: user.restaurantId } : {}),
      },
      select: {
        restaurantId: true,
        role: true,
        ...MEMBERSHIP_WITH_RESTAURANT,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership && user.restaurantId) {
      membership = await this.prisma.restaurantMembership.findFirst({
        where: { userId: user.id, isActive: true },
        select: {
          restaurantId: true,
          role: true,
          ...MEMBERSHIP_WITH_RESTAURANT,
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!membership || membership.restaurant.deletedAt) {
      throw new ForbiddenException('No active restaurant membership found.');
    }

    const status = membership.restaurant.status;
    const allowSuspended = opts?.allowSuspended === true;
    if (status === RestaurantStatus.ARCHIVED) {
      throw new ForbiddenException('No active restaurant membership found.');
    }
    if (status === RestaurantStatus.SUSPENDED && !allowSuspended) {
      throw new ForbiddenException(
        'Your restaurant is suspended. Complete payment or contact DilYum support.',
      );
    }
    if (
      status !== RestaurantStatus.ACTIVE &&
      !(allowSuspended && status === RestaurantStatus.SUSPENDED)
    ) {
      throw new ForbiddenException('No active restaurant membership found.');
    }

    if (allowedRoles?.length && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission for this action.');
    }

    return {
      userId: user.id,
      restaurantId: membership.restaurantId,
      membershipRole: membership.role,
      restaurantName: membership.restaurant.name,
      restaurantSlug: membership.restaurant.slug,
      restaurantStatus: status,
    };
  }

  async requireActiveMembership(
    user: { id: string; role: UserRole; restaurantId?: string },
    allowedRoles?: MembershipRole[],
  ): Promise<RestaurantContext> {
    return this.requireMembership(user, allowedRoles, { allowSuspended: false });
  }
}
