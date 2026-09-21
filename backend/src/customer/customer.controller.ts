import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentCustomerDevice } from './current-customer-device.decorator';
import { CustomerDeviceGuard } from './customer-device.guard';
import { CustomerDeviceService } from './customer-device.service';
import { CustomerPushService } from './customer-push.service';
import { CustomerService } from './customer.service';
import {
  CustomerListQueryDto,
  RegisterDeviceDto,
  SavePushSubscriptionDto,
  UpdateCustomerProfileDto,
} from './dto/customer.dto';

@Controller('customer')
export class CustomerController {
  constructor(
    private readonly devices: CustomerDeviceService,
    private readonly customers: CustomerService,
    private readonly push: CustomerPushService,
  ) {}

  @Post('device/register')
  async register(
    @Body() dto: RegisterDeviceDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    const result = await this.devices.register({
      publicId: dto.publicId,
      secret: dto.secret,
      userAgent: String(req.headers['user-agent'] || ''),
    });
    return {
      publicId: result.publicId,
      secret: result.secret,
    };
  }

  @Get('push/config')
  pushConfig(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.push.getPublicConfig();
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('profile')
  profile(
    @CurrentCustomerDevice() identity: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.getProfile(identity);
  }

  @UseGuards(CustomerDeviceGuard)
  @Patch('profile')
  updateProfile(
    @CurrentCustomerDevice() identity: any,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.customers.updateProfile(identity, dto);
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('orders')
  orders(
    @CurrentCustomerDevice() identity: any,
    @Query() query: CustomerListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.listOrders(identity, query, false);
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('orders/live')
  liveOrders(
    @CurrentCustomerDevice() identity: any,
    @Query() query: CustomerListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.listOrders(identity, query, true);
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('orders/:id')
  orderDetail(
    @CurrentCustomerDevice() identity: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.getOrder(identity, id);
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('transactions')
  transactions(
    @CurrentCustomerDevice() identity: any,
    @Query() query: CustomerListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.listTransactions(identity, query);
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('coupons')
  coupons(
    @CurrentCustomerDevice() identity: any,
    @Query() query: CustomerListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.listCoupons(identity, query);
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('notifications')
  notifications(
    @CurrentCustomerDevice() identity: any,
    @Query() query: CustomerListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.listNotifications(identity, query);
  }

  @UseGuards(CustomerDeviceGuard)
  @Get('notifications/unread-count')
  unread(
    @CurrentCustomerDevice() identity: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.customers.unreadCount(identity);
  }

  @UseGuards(CustomerDeviceGuard)
  @Patch('notifications/:id/read')
  markRead(
    @CurrentCustomerDevice() identity: any,
    @Param('id') id: string,
  ) {
    return this.customers.markRead(identity, id);
  }

  @UseGuards(CustomerDeviceGuard)
  @Post('notifications/read-all')
  markAllRead(@CurrentCustomerDevice() identity: any) {
    return this.customers.markAllRead(identity);
  }

  @UseGuards(CustomerDeviceGuard)
  @Post('restaurants/:slug/visit')
  visit(
    @CurrentCustomerDevice() identity: any,
    @Param('slug') slug: string,
  ) {
    return this.customers.recordVisit(identity, slug);
  }

  @UseGuards(CustomerDeviceGuard)
  @Post('device/push-subscription')
  savePush(
    @CurrentCustomerDevice() identity: any,
    @Body() dto: SavePushSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.push.saveSubscription(identity.deviceId, {
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      auth: dto.auth,
      userAgent: String(req.headers['user-agent'] || ''),
    });
  }

  @UseGuards(CustomerDeviceGuard)
  @Delete('device/push-subscription')
  deletePush(
    @CurrentCustomerDevice() identity: any,
    @Body() dto: { endpoint?: string },
  ) {
    return this.push.deleteSubscription(identity.deviceId, dto?.endpoint);
  }
}
