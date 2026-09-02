import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import { OrdersService } from './orders.service';
import { PublicOrdersController } from './public-orders.controller';
import { RestaurantOrdersController } from './restaurant-orders.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PublicOrdersController, RestaurantOrdersController],
  providers: [OrdersService, RestaurantContextService],
  exports: [OrdersService],
})
export class OrdersModule {}
