import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppRole } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { QrCodesService } from './qr-codes.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.SUPER_ADMIN)
export class AdminQrController {
  constructor(private readonly qrCodes: QrCodesService) {}

  @Get('qr')
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.qrCodes.listAdmin({ page, limit });
  }

  @Post('qr/backfill')
  backfill() {
    return this.qrCodes.backfillMissing();
  }

  @Get('restaurants/:restaurantId/qr')
  getOne(@Param('restaurantId') restaurantId: string) {
    return this.qrCodes.getAdminRestaurantQr(restaurantId);
  }

  @Post('restaurants/:restaurantId/qr')
  ensure(@Param('restaurantId') restaurantId: string) {
    return this.qrCodes.getAdminRestaurantQr(restaurantId);
  }

  @Post('restaurants/:restaurantId/qr/regenerate')
  regenerate(
    @CurrentUser() user: { id: string },
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.qrCodes.regenerateAdmin(restaurantId, user.id);
  }
}
