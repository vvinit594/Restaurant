import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PUBLIC_MENU_CACHE_CONTROL } from '../../common/public-cache';
import { PublicRestaurantsService } from './public-restaurants.service';

@Controller('public/restaurants')
export class PublicRestaurantsController {
  constructor(private readonly restaurantsService: PublicRestaurantsService) {}

  @Get()
  list(
    @Query('search') search: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (String(search || '').trim()) {
      // Search results are query-specific — do not CDN-cache.
      res.setHeader('Cache-Control', 'private, no-store');
    } else {
      res.setHeader('Cache-Control', PUBLIC_MENU_CACHE_CONTROL);
    }
    return this.restaurantsService.list(search);
  }

  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', PUBLIC_MENU_CACHE_CONTROL);
    return this.restaurantsService.getBySlug(slug);
  }
}
