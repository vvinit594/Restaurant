import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AdminRestaurantsModule } from './admin/restaurants/admin-restaurants.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicRestaurantsModule } from './public/restaurants/public-restaurants.module';
import { QrModule } from './qr/qr.module';
import { RestaurantDishesModule } from './restaurants/dishes/restaurant-dishes.module';
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
  ],
})
export class AppModule {}
