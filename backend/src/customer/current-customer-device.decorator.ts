import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CustomerDeviceIdentity } from './customer-device.service';

export const CurrentCustomerDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerDeviceIdentity => {
    const req = ctx.switchToHttp().getRequest();
    return req.customerDevice;
  },
);
