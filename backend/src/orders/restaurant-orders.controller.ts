import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppRole } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import { UpdateOrderStatusDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('restaurants/me/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  AppRole.RESTAURANT_OWNER,
  AppRole.RESTAURANT_MANAGER,
  AppRole.RESTAURANT_STAFF,
)
export class RestaurantOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly restaurantContext: RestaurantContextService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('active') active?: string,
    @Query('history') history?: string,
    @Query('since') since?: string,
    @Query('take') take?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    res?.setHeader('Cache-Control', 'private, no-store');
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    return this.orders.listRestaurantOrders(ctx.restaurantId, {
      status,
      active,
      history,
      since,
      take: take ? Number(take) : undefined,
      page,
      limit,
    });
  }

  @Get('stats')
  async stats(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    return this.orders.getOrderStats(ctx.restaurantId);
  }

  @Get(':id/kot')
  async getKot(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    return this.orders.getKot(ctx.restaurantId, id);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    return this.orders.getRestaurantOrder(ctx.restaurantId, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    const ctx = await this.restaurantContext.requireActiveMembership(user);
    return this.orders.updateStatus(ctx.restaurantId, id, dto.status);
  }
}
