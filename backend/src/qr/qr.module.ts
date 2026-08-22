import { Module } from '@nestjs/common';
import { RestaurantContextService } from '../restaurants/restaurant-context.service';
import { AdminQrController } from './admin-qr.controller';
import { PublicQrController } from './public-qr.controller';
import { QrCodesService } from './qr-codes.service';
import { QrService } from './qr.service';
import { RestaurantQrController } from './restaurant-qr.controller';

@Module({
  controllers: [AdminQrController, RestaurantQrController, PublicQrController],
  providers: [QrService, QrCodesService, RestaurantContextService],
  exports: [QrService, QrCodesService],
})
export class QrModule {}
