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
};

@Injectable()
export class RestaurantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async requireActiveMembership(
    user: { id: string; role: UserRole; restaurantId?: string },
    allowedRoles?: MembershipRole[],
  ): Promise<RestaurantContext> {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required.');
    }

    const membership = await this.prisma.restaurantMembership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        ...(user.restaurantId ? { restaurantId: user.restaurantId } : {}),
      },
      include: { restaurant: true },
      orderBy: { createdAt: 'asc' },
    });

    if (
      !membership ||
      membership.restaurant.deletedAt ||
      membership.restaurant.status !== RestaurantStatus.ACTIVE
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
    };
  }
}
