import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  QrCodeStatus,
  RestaurantStatus,
} from '@prisma/client';
import { AppRole } from '../common/constants';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.SUPER_ADMIN)
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const restaurantWhere = {
      deletedAt: null,
      NOT: { status: RestaurantStatus.ARCHIVED },
    } as const;

    const [
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      totalDishes,
      totalQrCodes,
      totalTables,
    ] = await Promise.all([
      this.prisma.restaurant.count({ where: restaurantWhere }),
      this.prisma.restaurant.count({
        where: { ...restaurantWhere, status: RestaurantStatus.ACTIVE },
      }),
      this.prisma.restaurant.count({
        where: { ...restaurantWhere, status: RestaurantStatus.SUSPENDED },
      }),
      this.prisma.dish.count({
        where: {
          deletedAt: null,
          restaurant: restaurantWhere,
        },
      }),
      this.prisma.qrCode.count({
        where: {
          status: QrCodeStatus.ACTIVE,
          restaurant: restaurantWhere,
        },
      }),
      this.prisma.branch.count({
        where: { restaurant: restaurantWhere },
      }),
    ]);

    return {
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      totalDishes,
      totalMenuItems: totalDishes,
      totalQrCodes,
      totalTables,
    };
  }
}
