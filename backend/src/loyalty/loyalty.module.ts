import { Module } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RestaurantDishesModule } from '../restaurants/dishes/restaurant-dishes.module';
import { EngagementService } from './engagement.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { ProgramCouponSync } from './program-coupon.sync';
import { LoyaltyWhatsappService } from './whatsapp/loyalty-whatsapp.service';
import { UnconfiguredWhatsappProvider } from './whatsapp/unconfigured-whatsapp.provider';

@Module({
  imports: [PrismaModule, RestaurantDishesModule, CustomerModule],
  controllers: [LoyaltyController],
  providers: [
    LoyaltyService,
    EngagementService,
    ProgramCouponSync,
    LoyaltyWhatsappService,
    UnconfiguredWhatsappProvider,
  ],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
