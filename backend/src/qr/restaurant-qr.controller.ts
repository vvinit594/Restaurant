import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AppRole } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { QrCodesService } from './qr-codes.service';

@Controller('restaurants/me/qr')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  AppRole.RESTAURANT_OWNER,
  AppRole.RESTAURANT_MANAGER,
)
export class RestaurantQrController {
  constructor(private readonly qrCodes: QrCodesService) {}

  @Get()
  getMine(@CurrentUser() user: any) {
    return this.qrCodes.getMyQr(user);
  }

  @Post('regenerate')
  regenerate(@CurrentUser() user: any) {
    return this.qrCodes.regenerateMyQr(user);
  }
}
