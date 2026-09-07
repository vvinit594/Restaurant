import { Module } from '@nestjs/common';
import { AdminRestaurantsModule } from '../admin/restaurants/admin-restaurants.module';
import { QrModule } from '../qr/qr.module';
import { AdminSalesController } from './admin-sales.controller';
import { CommissionService } from './commission.service';
import { SalesContextService } from './sales-context.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [AdminRestaurantsModule, QrModule],
  controllers: [SalesController, AdminSalesController],
  providers: [SalesService, SalesContextService, CommissionService],
  exports: [SalesService, CommissionService],
})
export class SalesModule {}
