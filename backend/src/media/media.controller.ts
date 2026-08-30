import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mime = String(file?.mimetype || '').toLowerCase();
        const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
          mime,
        );
        if (!ok) {
          cb(
            new BadRequestException(
              'Unsupported image format. Please upload JPG, PNG, or WebP.',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      folder?: string;
      kind?: string;
      restaurantId?: string;
      dishId?: string;
    },
    @CurrentUser() _user: { id: string },
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }
    return this.media.uploadBuffer(file, {
      folder: body?.folder,
      kind: body?.kind,
      restaurantId: body?.restaurantId,
      dishId: body?.dishId,
    });
  }
}
