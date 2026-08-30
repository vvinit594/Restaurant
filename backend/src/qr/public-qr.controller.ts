import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PUBLIC_MENU_CACHE_CONTROL } from '../common/public-cache';
import { QrCodesService } from './qr-codes.service';

@Controller('public/qr')
export class PublicQrController {
  constructor(private readonly qrCodes: QrCodesService) {}

  @Get(':token')
  resolve(
    @Param('token') token: string,
    @Query('slug') slug: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Same public menu payload as /public/restaurants/:slug — CDN-cacheable, read-only.
    res.setHeader('Cache-Control', PUBLIC_MENU_CACHE_CONTROL);
    return this.qrCodes.resolveByToken(token, slug);
  }
}
