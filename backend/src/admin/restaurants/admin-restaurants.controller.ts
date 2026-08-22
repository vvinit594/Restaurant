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
import { RestaurantStatus } from '@prisma/client';
import { AppRole } from '../../common/constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRestaurantsService } from './admin-restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';

@Controller('admin/restaurants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.SUPER_ADMIN)
export class AdminRestaurantsController {
  constructor(private readonly restaurantsService: AdminRestaurantsService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.restaurantsService.list({ search, status });
  }

  @Get('plans')
  listPlans() {
    return this.restaurantsService.listPlans();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.restaurantsService.getOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; email?: string },
    @Body() dto: CreateRestaurantDto,
  ) {
    return this.restaurantsService.create(dto, user);
  }

  @Patch(':id/suspend')
  suspend(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.restaurantsService.setStatus(
      id,
      RestaurantStatus.SUSPENDED,
      user,
    );
  }

  @Patch(':id/activate')
  activate(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.restaurantsService.setStatus(
      id,
      RestaurantStatus.ACTIVE,
      user,
    );
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.restaurantsService.softDelete(id, user);
  }
}
