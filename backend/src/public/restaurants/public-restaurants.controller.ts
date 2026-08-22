import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicRestaurantsService } from './public-restaurants.service';

@Controller('public/restaurants')
export class PublicRestaurantsController {
  constructor(private readonly restaurantsService: PublicRestaurantsService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.restaurantsService.list(search);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.restaurantsService.getBySlug(slug);
  }
}
