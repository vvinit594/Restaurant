import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RestaurantDishesModule } from '../restaurants/dishes/restaurant-dishes.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyWhatsappService } from './whatsapp/loyalty-whatsapp.service';
import { UnconfiguredWhatsappProvider } from './whatsapp/unconfigured-whatsapp.provider';

@Module({
  imports: [PrismaModule, RestaurantDishesModule],
  controllers: [LoyaltyController],
  providers: [
    LoyaltyService,
    LoyaltyWhatsappService,
    UnconfiguredWhatsappProvider,
  ],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
