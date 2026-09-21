import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CustomerDeviceService } from '../customer/customer-device.service';
import { CreatePublicOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';
import { PublicOrderRateLimitGuard } from './public-order-rate-limit.guard';

@Controller('public/restaurants/:slug')
export class PublicOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly devices: CustomerDeviceService,
  ) {}

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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.devices.resolveOptionalFromRequest(req).then((identity) =>
      this.orders.createPublicOrder(slug, dto, identity),
    );
  }
}
