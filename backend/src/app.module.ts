import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AdminRestaurantsModule } from './admin/restaurants/admin-restaurants.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicRestaurantsModule } from './public/restaurants/public-restaurants.module';
import { QrModule } from './qr/qr.module';
import { RestaurantDishesModule } from './restaurants/dishes/restaurant-dishes.module';
import { SalesModule } from './sales/sales.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    AdminRestaurantsModule,
    PublicRestaurantsModule,
    RestaurantDishesModule,
    QrModule,
    MediaModule,
    OrdersModule,
    SalesModule,
    PaymentsModule,
  ],
})
export class AppModule {}
