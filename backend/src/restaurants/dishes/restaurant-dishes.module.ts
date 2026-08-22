import { Module } from '@nestjs/common';
import { RestaurantContextService } from '../restaurant-context.service';
import { RestaurantPortalController } from '../restaurant-portal.controller';
import { RestaurantPortalService } from '../restaurant-portal.service';
import { RestaurantDishesController } from './restaurant-dishes.controller';
import { RestaurantDishesService } from './restaurant-dishes.service';

@Module({
  controllers: [RestaurantDishesController, RestaurantPortalController],
  providers: [
    RestaurantDishesService,
    RestaurantPortalService,
    RestaurantContextService,
  ],
  exports: [
    RestaurantDishesService,
    RestaurantPortalService,
    RestaurantContextService,
  ],
})
export class RestaurantDishesModule {}
