import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RestaurantStatus, UserRole } from '@prisma/client';
import { auditLog } from '../common/audit-log';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser, UsersService } from '../users/users.service';

const RESTAURANT_ROLES = new Set<UserRole>([
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_MANAGER,
  UserRole.RESTAURANT_STAFF,
]);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async adminLogin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const safeUser = this.usersService.toSafeUser(user);
    const accessToken = await this.signToken(safeUser);

    auditLog('ADMIN_LOGIN', {
      adminUserId: safeUser.id,
      email: safeUser.email,
    });

    return {
      accessToken,
      user: {
        id: safeUser.id,
        name: safeUser.name,
        email: safeUser.email,
        role: safeUser.role,
      },
    };
  }

  async restaurantLogin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive || !RESTAURANT_ROLES.has(user.role)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const membership = await this.prisma.restaurantMembership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        restaurant: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership || membership.restaurant.deletedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (membership.restaurant.status !== RestaurantStatus.ACTIVE) {
      throw new UnauthorizedException(
        'This restaurant is not active. Contact DilYum support.',
      );
    }

    const safeUser = this.usersService.toSafeUser(user);
    const accessToken = await this.signToken(safeUser, {
      restaurantId: membership.restaurantId,
      membershipRole: membership.role,
    });

    auditLog('RESTAURANT_LOGIN', {
      userId: safeUser.id,
      email: safeUser.email,
      restaurantId: membership.restaurantId,
      membershipRole: membership.role,
    });

    return {
      accessToken,
      user: {
        id: safeUser.id,
        name: safeUser.name,
        email: safeUser.email,
        role: safeUser.role,
      },
      restaurant: {
        id: membership.restaurant.id,
        name: membership.restaurant.name,
        slug: membership.restaurant.slug,
      },
    };
  }

  async getMe(user: SafeUser & { restaurantId?: string }) {
    const base = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    if (!RESTAURANT_ROLES.has(user.role)) {
      return base;
    }

    // Prefer JWT restaurantId, but fall back to any active membership so a
    // stale claim never blanks the portal session.
    let membership = user.restaurantId
      ? await this.prisma.restaurantMembership.findFirst({
          where: {
            userId: user.id,
            restaurantId: user.restaurantId,
            isActive: true,
          },
          include: { restaurant: true },
        })
      : null;

    if (!membership) {
      membership = await this.prisma.restaurantMembership.findFirst({
        where: { userId: user.id, isActive: true },
        include: { restaurant: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (
      !membership ||
      membership.restaurant.deletedAt ||
      membership.restaurant.status === RestaurantStatus.ARCHIVED
    ) {
      return base;
    }

    return {
      ...base,
      restaurant: {
        id: membership.restaurant.id,
        name: membership.restaurant.name,
        slug: membership.restaurant.slug,
        status: membership.restaurant.status,
      },
    };
  }

  logout() {
    return { success: true };
  }

  private async signToken(
    user: SafeUser,
    extras: { restaurantId?: string; membershipRole?: string } = {},
  ) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '12h';
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        ...(extras.restaurantId ? { restaurantId: extras.restaurantId } : {}),
        ...(extras.membershipRole
          ? { membershipRole: extras.membershipRole }
          : {}),
      },
      {
        expiresIn: expiresIn as `${number}h` | `${number}d` | number,
      },
    );
  }
}
