import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RestaurantDishesModule } from '../restaurants/dishes/restaurant-dishes.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayClientService } from './razorpay-client.service';

@Module({
  imports: [PrismaModule, forwardRef(() => RestaurantDishesModule)],
  controllers: [PaymentsController],
  providers: [RazorpayClientService, PaymentsService],
  exports: [PaymentsService, RazorpayClientService],
})
export class PaymentsModule {}
