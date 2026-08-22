import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AppRole } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateRestaurantProfileDto } from './dto/update-restaurant-profile.dto';
import { RestaurantPortalService } from './restaurant-portal.service';

@Controller('restaurants/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  AppRole.RESTAURANT_OWNER,
  AppRole.RESTAURANT_MANAGER,
  AppRole.RESTAURANT_STAFF,
)
export class RestaurantPortalController {
  constructor(private readonly portal: RestaurantPortalService) {}

  @Get()
  getProfile(@CurrentUser() user: any) {
    return this.portal.getProfile(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: any) {
    return this.portal.getDashboardStats(user);
  }

  @Patch()
  @Roles(AppRole.RESTAURANT_OWNER)
  updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateRestaurantProfileDto,
  ) {
    return this.portal.updateProfile(user, dto);
  }
}
