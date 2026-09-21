import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerModule } from '../customer/customer.module';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import { OrdersService } from './orders.service';
import { PublicOrdersController } from './public-orders.controller';
import { RestaurantOrdersController } from './restaurant-orders.controller';

@Module({
  imports: [PrismaModule, CustomerModule],
  controllers: [PublicOrdersController, RestaurantOrdersController],
  providers: [OrdersService, RestaurantContextService],
  exports: [OrdersService],
})
export class OrdersModule {}
