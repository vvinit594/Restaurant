import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import {
  CreateLoyaltyCustomerDto,
  LoyaltyCustomerListQueryDto,
  SendLoyaltyWhatsappDto,
  UpdateLoyaltyCustomerDto,
  UpdateLoyaltyProgramDto,
} from './dto/loyalty.dto';
import {
  CreateCouponDto,
  EngagementCouponQueryDto,
  EngagementCustomerQueryDto,
  SendPushNotificationDto,
  UpdateCouponDto,
} from './dto/engagement.dto';
import { EngagementService } from './engagement.service';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  AppRole.RESTAURANT_OWNER,
  AppRole.RESTAURANT_MANAGER,
  AppRole.RESTAURANT_STAFF,
)
export class LoyaltyController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly engagement: EngagementService,
  ) {}

  @Get('stats')
  stats(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.loyalty.getStats(user);
  }

  @Get('engagement/customers')
  engagementCustomers(
    @CurrentUser() user: any,
    @Query() query: EngagementCustomerQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.engagement.listCustomers(user, query);
  }

  @Get('engagement/coupons')
  engagementCoupons(
    @CurrentUser() user: any,
    @Query() query: EngagementCouponQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.engagement.listCoupons(user, query);
  }

  @Post('engagement/coupons')
  createEngagementCoupon(
    @CurrentUser() user: any,
    @Body() dto: CreateCouponDto,
  ) {
    return this.engagement.createCoupon(user, dto);
  }

  @Patch('engagement/coupons/:id')
  updateEngagementCoupon(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.engagement.updateCoupon(user, id, dto);
  }

  @Delete('engagement/coupons/:id')
  deleteEngagementCoupon(@CurrentUser() user: any, @Param('id') id: string) {
    return this.engagement.deleteCoupon(user, id);
  }

  @Get('engagement/campaigns')
  engagementCampaigns(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.engagement.listCampaigns(user);
  }

  @Post('engagement/notifications/send')
  sendEngagementNotification(
    @CurrentUser() user: any,
    @Body() dto: SendPushNotificationDto,
  ) {
    return this.engagement.sendNotification(user, dto);
  }

  @Get('customers')
  listCustomers(
    @CurrentUser() user: any,
    @Query() query: LoyaltyCustomerListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.loyalty.listCustomers(user, query);
  }

  @Post('customers')
  createCustomer(@CurrentUser() user: any, @Body() dto: CreateLoyaltyCustomerDto) {
    return this.loyalty.createCustomer(user, dto);
  }

  @Get('customers/:id')
  getCustomer(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.loyalty.getCustomer(user, id);
  }

  @Patch('customers/:id')
  updateCustomer(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateLoyaltyCustomerDto,
  ) {
    return this.loyalty.updateCustomer(user, id, dto);
  }

  @Delete('customers/:id')
  deleteCustomer(@CurrentUser() user: any, @Param('id') id: string) {
    return this.loyalty.deleteCustomer(user, id);
  }

  @Post('customers/:id/send-whatsapp')
  sendWhatsapp(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SendLoyaltyWhatsappDto,
  ) {
    return this.loyalty.sendWhatsappOffer(user, id, dto);
  }

  @Get('programs')
  listPrograms(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.loyalty.listPrograms(user);
  }

  @Patch('programs/:programType')
  @Roles(AppRole.RESTAURANT_OWNER)
  updateProgram(
    @CurrentUser() user: any,
    @Param('programType') programType: string,
    @Body() dto: UpdateLoyaltyProgramDto,
  ) {
    return this.loyalty.updateProgram(user, programType, dto);
  }
}
