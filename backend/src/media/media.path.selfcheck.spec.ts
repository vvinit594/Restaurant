/**
 * ponytail: assert MediaService path builder + http URL validator.
 * Run: npx jest src/media/media.path.selfcheck.spec.ts
 */
import { validate } from 'class-validator';
import { IsHttpImageUrl } from '../common/validators/is-http-image-url';
import { MediaService } from './media.service';
import { ConfigService } from '@nestjs/config';

class Sample {
  @IsHttpImageUrl()
  imageUrl?: string;
}

describe('Phase 0 image URL rules', () => {
  const media = new MediaService({
    get: () => undefined,
  } as unknown as ConfigService);

  it('builds restaurant logo/cover and dish keys', () => {
    const logo = media.buildObjectKey({
      kind: 'logo',
      restaurantId: 'rest_1',
      mime: 'image/png',
      originalName: 'a.png',
    });
    expect(logo).toMatch(/^restaurants\/rest_1\/logo\/.+\.png$/);

    const cover = media.buildObjectKey({
      kind: 'cover',
      restaurantId: 'rest_1',
      mime: 'image/jpeg',
      originalName: 'b.jpg',
    });
    expect(cover).toMatch(/^restaurants\/rest_1\/cover\/.+\.jpg$/);

    const dish = media.buildObjectKey({
      kind: 'dish',
      restaurantId: 'rest_1',
      dishId: 'dish_9',
      mime: 'image/webp',
      originalName: 'c.webp',
    });
    expect(dish).toMatch(/^dishes\/rest_1\/dish_9\/.+\.webp$/);
  });

  it('rejects Base64 data URLs and accepts https', async () => {
    const bad = new Sample();
    bad.imageUrl = 'data:image/jpeg;base64,aaaa';
    const badErrs = await validate(bad);
    expect(badErrs.length).toBeGreaterThan(0);

    const good = new Sample();
    good.imageUrl =
      'https://xyz.supabase.co/storage/v1/object/public/media/x.jpg';
    const goodErrs = await validate(good);
    expect(goodErrs.length).toBe(0);
  });
});
