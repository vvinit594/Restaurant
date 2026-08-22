import { validateImageFile, resolveImageUrl, IMAGE_ERROR } from './mediaApi';

function fakeFile({ name, type, size }) {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

test('validateImageFile accepts jpeg/png/webp under 5MB', () => {
  expect(validateImageFile(fakeFile({ name: 'a.jpg', type: 'image/jpeg', size: 100 })).ok).toBe(true);
  expect(validateImageFile(fakeFile({ name: 'a.png', type: 'image/png', size: 100 })).ok).toBe(true);
  expect(validateImageFile(fakeFile({ name: 'a.webp', type: 'image/webp', size: 100 })).ok).toBe(true);
});

test('validateImageFile rejects svg/pdf/oversize', () => {
  expect(validateImageFile(fakeFile({ name: 'x.svg', type: 'image/svg+xml', size: 100 })).ok).toBe(false);
  const bad = validateImageFile(fakeFile({ name: 'x.pdf', type: 'application/pdf', size: 100 }));
  expect(bad.ok).toBe(false);
  expect(bad.message).toBe(IMAGE_ERROR);

  const huge = validateImageFile(
    fakeFile({ name: 'big.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 })
  );
  expect(huge.ok).toBe(false);
  expect(huge.message).toBe(IMAGE_ERROR);
});

test('resolveImageUrl prefers uploaded file over URL', async () => {
  const file = fakeFile({ name: 'dish.png', type: 'image/png', size: 32 });
  const fromFile = await resolveImageUrl({
    url: 'https://cdn.example.com/old.jpg',
    file,
  });
  expect(fromFile.startsWith('data:image/png')).toBe(true);

  const fromUrl = await resolveImageUrl({
    url: 'https://cdn.example.com/dish.jpg',
    file: null,
  });
  expect(fromUrl).toBe('https://cdn.example.com/dish.jpg');
});
