import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
/** Stay under Vercel serverless request body limit (~4.5MB). */
const MAX_BYTES = 4 * 1024 * 1024;
const BUCKET = 'media';
const SIZE_ERROR = 'Image must be smaller than 4MB.';

@Injectable()
export class MediaService {
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = String(this.config.get<string>('SUPABASE_URL') || '').trim();
    const key = String(
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '',
    ).trim();

    if (!url || !key) {
      throw new ServiceUnavailableException(
        'Image upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }

  validateFile(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required.');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(SIZE_ERROR);
    }
    const mime = String(file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Unsupported image format. Please upload JPG, PNG, or WebP.',
      );
    }
  }

  private extFor(mime: string, originalName = '') {
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    const fromName = originalName.match(/\.(jpe?g|png|webp)$/i)?.[1];
    if (fromName) return fromName.toLowerCase().replace('jpeg', 'jpg');
    return 'jpg';
  }

  /**
   * Build storage object key.
   * Preferred: restaurants/<id>/logo|cover/<uuid>.ext
   *            dishes/<restaurantId>/<dishId|pending>/<uuid>.ext
   */
  buildObjectKey(opts: {
    folder?: string;
    restaurantId?: string;
    dishId?: string;
    kind?: string;
    mime: string;
    originalName?: string;
  }) {
    const ext = this.extFor(opts.mime, opts.originalName);
    const file = `${randomUUID()}.${ext}`;
    const kind = String(opts.kind || '').toLowerCase();
    const restaurantId = String(opts.restaurantId || '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const dishId = String(opts.dishId || '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);

    if (kind === 'logo' || kind === 'cover') {
      const rid = restaurantId || 'pending';
      return `restaurants/${rid}/${kind}/${file}`;
    }
    if (kind === 'dish') {
      const rid = restaurantId || 'pending';
      const did = dishId || 'pending';
      return `dishes/${rid}/${did}/${file}`;
    }

    // Legacy folder strings from frontend (sanitized)
    const folder = String(opts.folder || 'uploads')
      .replace(/\\/g, '/')
      .replace(/\.\./g, '')
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .replace(/^\/+|\/+$/g, '')
      .slice(0, 120);
    return `${folder || 'uploads'}/${file}`;
  }

  private async ensurePublicBucket(client: SupabaseClient) {
    const { data } = await client.storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await client.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME],
    });
    // Race: another process may have created it
    if (error && !/already exists/i.test(error.message || '')) {
      throw new ServiceUnavailableException(
        `Storage bucket "${BUCKET}" is missing and could not be created: ${error.message}`,
      );
    }
  }

  async uploadBuffer(
    file: Express.Multer.File,
    meta: {
      folder?: string;
      restaurantId?: string;
      dishId?: string;
      kind?: string;
    } = {},
  ) {
    this.validateFile(file);
    const client = this.getClient();
    await this.ensurePublicBucket(client);
    const storageKey = this.buildObjectKey({
      ...meta,
      mime: file.mimetype,
      originalName: file.originalname,
    });

    const { error } = await client.storage.from(BUCKET).upload(storageKey, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
      cacheControl: '31536000',
    });

    if (error) {
      throw new BadRequestException(
        error.message || 'Failed to upload image to storage.',
      );
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(storageKey);
    const url = data?.publicUrl;
    if (!url) {
      throw new BadRequestException('Upload succeeded but public URL was missing.');
    }

    return { url, storageKey, bucket: BUCKET };
  }

  /** Decode data-URL / raw base64 and upload. Used by migration only. */
  async uploadBase64(
    dataUrlOrBase64: string,
    meta: {
      folder?: string;
      restaurantId?: string;
      dishId?: string;
      kind?: string;
    } = {},
  ) {
    const raw = String(dataUrlOrBase64 || '');
    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
    const mime = match?.[1] || 'image/jpeg';
    const b64 = match?.[2] || raw.replace(/^data:[^;]+;base64,/, '');
    if (!b64 || b64.length < 32) {
      throw new BadRequestException('Invalid base64 image payload.');
    }
    const buffer = Buffer.from(b64, 'base64');
    const fake = {
      buffer,
      size: buffer.length,
      mimetype: mime,
      originalname: `migrated.${this.extFor(mime)}`,
    } as Express.Multer.File;
    return this.uploadBuffer(fake, meta);
  }
}
