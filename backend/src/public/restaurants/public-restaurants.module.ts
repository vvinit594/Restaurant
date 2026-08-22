import { Module } from '@nestjs/common';
import { PublicRestaurantsController } from './public-restaurants.controller';
import { PublicRestaurantsService } from './public-restaurants.service';

@Module({
  controllers: [PublicRestaurantsController],
  providers: [PublicRestaurantsService],
})
export class PublicRestaurantsModule {}
