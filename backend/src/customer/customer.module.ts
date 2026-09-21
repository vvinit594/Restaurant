import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerController } from './customer.controller';
import { CustomerDeviceGuard } from './customer-device.guard';
import { CustomerDeviceService } from './customer-device.service';
import { CustomerPushService } from './customer-push.service';
import { CustomerService } from './customer.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerController],
  providers: [
    CustomerDeviceService,
    CustomerDeviceGuard,
    CustomerService,
    CustomerPushService,
  ],
  exports: [CustomerDeviceService, CustomerService, CustomerPushService],
})
export class CustomerModule {}
