import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppRole } from '../../common/constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateDishDto, UpdateDishDto } from './dto/dish.dto';
import { RestaurantDishesService } from './restaurant-dishes.service';

@Controller('restaurants/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  AppRole.RESTAURANT_OWNER,
  AppRole.RESTAURANT_MANAGER,
  AppRole.RESTAURANT_STAFF,
)
export class RestaurantDishesController {
  constructor(private readonly dishesService: RestaurantDishesService) {}

  @Get('categories')
  listCategories(@CurrentUser() user: any) {
    return this.dishesService.listCategories(user);
  }

  @Get('dishes')
  listDishes(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.dishesService.listDishes(user, { search, category });
  }

  @Get('dishes/:id')
  getDish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dishesService.getDish(user, id);
  }

  @Post('dishes')
  createDish(@CurrentUser() user: any, @Body() dto: CreateDishDto) {
    return this.dishesService.createDish(user, dto);
  }

  @Patch('dishes/:id')
  updateDish(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDishDto,
  ) {
    return this.dishesService.updateDish(user, id, dto);
  }

  @Delete('dishes/:id')
  deleteDish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dishesService.deleteDish(user, id);
  }
}
