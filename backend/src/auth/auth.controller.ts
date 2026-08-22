import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AppRole } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { SafeUser } from '../users/users.service';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RestaurantLoginDto } from './dto/restaurant-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  @UseGuards(AuthRateLimitGuard)
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  @Post('restaurant/login')
  @UseGuards(AuthRateLimitGuard)
  restaurantLogin(@Body() dto: RestaurantLoginDto) {
    return this.authService.restaurantLogin(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  me(@CurrentUser() user: SafeUser & { restaurantId?: string }) {
    return this.authService.getMe(user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    return this.authService.logout();
  }

  @Get('admin/ping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.SUPER_ADMIN)
  adminPing(@CurrentUser() user: SafeUser) {
    return { ok: true, role: user.role };
  }
}
