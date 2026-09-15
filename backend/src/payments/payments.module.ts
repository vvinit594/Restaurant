import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { RestaurantDishesModule } from '../restaurants/dishes/restaurant-dishes.module';
import { PaymentsController } from './payments.controller';
import { PaymentsGraceCron } from './payments-grace.cron';
import { PaymentsService } from './payments.service';
import { RazorpayClientService } from './razorpay-client.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    forwardRef(() => RestaurantDishesModule),
  ],
  controllers: [PaymentsController],
  providers: [RazorpayClientService, PaymentsService, PaymentsGraceCron],
  exports: [PaymentsService, RazorpayClientService],
})
export class PaymentsModule {}
