import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreatePublicOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';
import { PublicOrderRateLimitGuard } from './public-order-rate-limit.guard';

@Controller('public/restaurants/:slug')
export class PublicOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('tables')
  listTables(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.orders.listPublicTables(slug);
  }

  @Post('orders')
  @UseGuards(PublicOrderRateLimitGuard)
  createOrder(
    @Param('slug') slug: string,
    @Body() dto: CreatePublicOrderDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.orders.createPublicOrder(slug, dto);
  }
}
