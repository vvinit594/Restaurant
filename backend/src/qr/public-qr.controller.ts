import { Controller, Get, Param, Query } from '@nestjs/common';
import { QrCodesService } from './qr-codes.service';

@Controller('public/qr')
export class PublicQrController {
  constructor(private readonly qrCodes: QrCodesService) {}

  @Get(':token')
  resolve(
    @Param('token') token: string,
    @Query('slug') slug?: string,
  ) {
    return this.qrCodes.resolveByToken(token, slug);
  }
}
