jest.mock('./apiClient', () => ({
  apiRequest: jest.fn(),
}));
jest.mock('./adminAuth', () => ({
  getAdminSessionSync: jest.fn(() => ({ token: 'test-token' })),
}));
jest.mock('./restaurantAuth', () => ({
  getRestaurantSessionSync: jest.fn(() => null),
}));

import { apiRequest } from './apiClient';
import {
  validateImageFile,
  resolveImageUrl,
  IMAGE_ERROR_FORMAT,
  IMAGE_ERROR_SIZE,
} from './mediaApi';

function fakeFile({ name, type, size }) {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

beforeEach(() => {
  apiRequest.mockReset();
});

test('validateImageFile accepts jpeg/png/webp under 5MB', () => {
  expect(validateImageFile(fakeFile({ name: 'a.jpg', type: 'image/jpeg', size: 100 })).ok).toBe(true);
  expect(validateImageFile(fakeFile({ name: 'a.png', type: 'image/png', size: 100 })).ok).toBe(true);
  expect(validateImageFile(fakeFile({ name: 'a.webp', type: 'image/webp', size: 100 })).ok).toBe(true);
});

test('validateImageFile rejects svg/pdf/oversize', () => {
  expect(validateImageFile(fakeFile({ name: 'x.svg', type: 'image/svg+xml', size: 100 })).ok).toBe(false);
  const bad = validateImageFile(fakeFile({ name: 'x.pdf', type: 'application/pdf', size: 100 }));
  expect(bad.ok).toBe(false);
  expect(bad.message).toBe(IMAGE_ERROR_FORMAT);

  const huge = validateImageFile(
    fakeFile({ name: 'big.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 })
  );
  expect(huge.ok).toBe(false);
  expect(huge.message).toBe(IMAGE_ERROR_SIZE);
});

test('resolveImageUrl returns URL when no file', async () => {
  const fromUrl = await resolveImageUrl({
    url: 'https://cdn.example.com/dish.jpg',
    file: null,
  });
  expect(fromUrl).toBe('https://cdn.example.com/dish.jpg');
});

test('resolveImageUrl uploads file via API (no Base64)', async () => {
  const file = fakeFile({ name: 'dish.png', type: 'image/png', size: 32 });
  const storageUrl =
    'https://example.supabase.co/storage/v1/object/public/media/dishes/r1/d1/x.png';

  apiRequest.mockResolvedValue({
    url: storageUrl,
    storageKey: 'dishes/r1/d1/x.png',
  });

  const fromFile = await resolveImageUrl(
    { url: 'https://cdn.example.com/old.jpg', file },
    { kind: 'dish', restaurantId: 'r1', dishId: 'd1', token: 'test-token' },
  );

  expect(fromFile).toBe(storageUrl);
  expect(fromFile.startsWith('data:')).toBe(false);
  expect(apiRequest).toHaveBeenCalledWith(
    '/media/upload',
    expect.objectContaining({ method: 'POST' }),
  );
  const callBody = apiRequest.mock.calls[0][1].body;
  expect(callBody).toBeInstanceOf(FormData);
});
