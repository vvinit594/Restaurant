import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateRestaurantDto } from '../admin/restaurants/dto/create-restaurant.dto';
import { AppRole } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { SafeUser } from '../users/users.service';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.SALES_PERSON)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: SafeUser) {
    return this.salesService.getDashboard(user);
  }

  @Get('analytics')
  analytics(@CurrentUser() user: SafeUser, @Query('range') range?: string) {
    return this.salesService.getAnalytics(user, range || 'all');
  }

  @Get('commission')
  commission(@CurrentUser() user: SafeUser) {
    return this.salesService.getCommission(user);
  }

  @Get('plans')
  plans(@CurrentUser() user: SafeUser) {
    return this.salesService.listPlans(user);
  }

  @Get('restaurants')
  restaurants(@CurrentUser() user: SafeUser) {
    return this.salesService.listRestaurants(user);
  }

  @Post('restaurants')
  createRestaurant(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateRestaurantDto,
  ) {
    return this.salesService.createRestaurant(user, dto);
  }

  @Get('restaurants/:id')
  restaurant(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.salesService.getRestaurant(user, id);
  }

  @Get('qr')
  qr(@CurrentUser() user: SafeUser) {
    return this.salesService.listQr(user);
  }

  @Get('leads')
  leads(@CurrentUser() user: SafeUser) {
    return this.salesService.listLeads(user);
  }

  @Post('leads')
  createLead(
    @CurrentUser() user: SafeUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.salesService.createLead(user, body as never);
  }

  @Patch('leads/:id')
  updateLead(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.salesService.updateLead(user, id, body as never);
  }

  @Get('profile')
  profile(@CurrentUser() user: SafeUser) {
    return this.salesService.getProfile(user);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: SafeUser,
    @Body() body: { name?: string; phone?: string },
  ) {
    return this.salesService.updateProfile(user, body);
  }
}
