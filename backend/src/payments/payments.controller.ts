import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { MembershipRole, UserRole } from '@prisma/client';
import { AppRole } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import { PaymentsService } from './payments.service';
import { RazorpayClientService } from './razorpay-client.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly razorpay: RazorpayClientService,
    private readonly restaurantContext: RestaurantContextService,
  ) {}

  /** Public key id only — safe for Checkout. */
  @Get('razorpay/config')
  getConfig() {
    return this.payments.getPublicKeyId();
  }

  /**
   * Same grace-period job as @Cron(EVERY_HOUR).
   * GitHub Actions invokes this hourly because in-process timers do not keep
   * running between Vercel serverless invocations.
   */
  @Get('cron/grace-expiry')
  async cronGraceExpiry(@Headers('authorization') authorization?: string) {
    const secret = String(process.env.CRON_SECRET || '').trim();
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }
    return this.payments.suspendExpiredGracePeriods();
  }

  @Post('razorpay/webhook')
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: any,
  ) {
    const raw =
      req.rawBody ||
      (Buffer.isBuffer((req as any).body)
        ? (req as any).body
        : Buffer.from(JSON.stringify(body || {})));

    if (!this.razorpay.verifyWebhookSignature(raw, signature || '')) {
      this.logger.warn(
        `Razorpay webhook signature mismatch (rawBytes=${
          Buffer.isBuffer(raw) ? raw.length : String(raw).length
        }, hasRawBody=${Boolean(req.rawBody)})`,
      );
      throw new BadRequestException('Invalid Razorpay webhook signature.');
    }

    const event =
      typeof body === 'object' && body && !Buffer.isBuffer(body)
        ? body
        : JSON.parse(raw.toString('utf8'));
    return this.payments.processWebhookEvent(event);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.SUPER_ADMIN)
  @Get('admin/restaurants/:restaurantId/billing')
  adminBilling(@Param('restaurantId') restaurantId: string) {
    return this.payments.listPaymentsForAdmin(restaurantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.SUPER_ADMIN)
  @Post('admin/restaurants/:restaurantId/checkout')
  adminCheckout(@Param('restaurantId') restaurantId: string) {
    return this.payments.retryCheckout(restaurantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AppRole.RESTAURANT_OWNER,
    AppRole.RESTAURANT_MANAGER,
    AppRole.RESTAURANT_STAFF,
  )
  @Get('restaurant/billing')
  async restaurantBilling(
    @CurrentUser() user: { id: string; role: UserRole; restaurantId?: string },
  ) {
    const ctx = await this.restaurantContext.requireMembership(user, undefined, {
      allowSuspended: true,
    });
    return this.payments.getRestaurantBilling(ctx.restaurantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.RESTAURANT_OWNER, AppRole.RESTAURANT_MANAGER)
  @Post('restaurant/checkout')
  async restaurantCheckout(
    @CurrentUser() user: { id: string; role: UserRole; restaurantId?: string },
  ) {
    const ctx = await this.restaurantContext.requireMembership(
      user,
      [MembershipRole.RESTAURANT_OWNER, MembershipRole.RESTAURANT_MANAGER],
      { allowSuspended: true },
    );
    return this.payments.retryCheckout(ctx.restaurantId);
  }
}
