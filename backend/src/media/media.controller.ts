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
      limits: { fileSize: 5 * 1024 * 1024 },
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
