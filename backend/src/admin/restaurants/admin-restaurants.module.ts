import { Module, forwardRef } from '@nestjs/common';
import { QrModule } from '../../qr/qr.module';
import { PaymentsModule } from '../../payments/payments.module';
import { AdminDashboardController } from '../admin-dashboard.controller';
import { AdminRestaurantsController } from './admin-restaurants.controller';
import { AdminRestaurantsService } from './admin-restaurants.service';

@Module({
  imports: [QrModule, forwardRef(() => PaymentsModule)],
  controllers: [AdminRestaurantsController, AdminDashboardController],
  providers: [AdminRestaurantsService],
  exports: [AdminRestaurantsService],
})
export class AdminRestaurantsModule {}
