import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomerDeviceService } from './customer-device.service';

@Injectable()
export class CustomerDeviceGuard implements CanActivate {
  constructor(private readonly devices: CustomerDeviceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const identity = await this.devices.resolveFromRequest(req);
    if (!identity) {
      throw new UnauthorizedException('Customer device registration required.');
    }
    req.customerDevice = identity;
    return true;
  }
}
