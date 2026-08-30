/**
 * @jest-environment node
 */
import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const store = new Map();

beforeAll(() => {
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

beforeEach(() => {
  store.clear();
  store.set(
    'dilyum_admin_restaurant_session',
    JSON.stringify({
      token: 'rest_jwt',
      user: {
        id: 'u1',
        role: 'RESTAURANT_OWNER',
        restaurantId: 'r1',
        restaurantName: 'Test',
      },
      permissions: {
        viewMenu: true,
        editDish: true,
        addDish: true,
        deleteDish: true,
      },
      expiresAt: Date.now() + 60_000,
    }),
  );
});

test('updateMenuItem availability toggle sends only available flag', async () => {
  let captured;
  global.fetch = jest.fn(async (url, options = {}) => {
    captured = {
      url: String(url),
      method: options.method,
      body: JSON.parse(options.body || '{}'),
      auth: options.headers?.Authorization,
    };
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: 'dish_1',
          available: false,
          name: 'Pav Bhaji',
          price: 100,
        }),
    };
  });

  const { updateMenuItem } = await import('./restaurantMenuApi');
  await updateMenuItem('dish_1', { available: false });

  expect(captured.method).toBe('PATCH');
  expect(captured.url).toContain('/restaurants/me/dishes/dish_1');
  expect(captured.auth).toContain('rest_jwt');
  expect(captured.body).toEqual({ available: false });
  expect(captured.body).not.toHaveProperty('price');
  expect(captured.body).not.toHaveProperty('name');
  expect(captured.body).not.toHaveProperty('published');
});

test('updateMenuItem full edit still sends provided dish fields', async () => {
  let captured;
  global.fetch = jest.fn(async (_url, options = {}) => {
    captured = JSON.parse(options.body || '{}');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'dish_1', ...captured }),
    };
  });

  const { updateMenuItem } = await import('./restaurantMenuApi');
  await updateMenuItem('dish_1', {
    name: 'Pav Bhaji',
    price: 100,
    category: 'Main Course',
    available: true,
    published: true,
    isVeg: true,
  });

  expect(captured.name).toBe('Pav Bhaji');
  expect(captured.price).toBe(100);
  expect(captured.available).toBe(true);
  expect(captured.isVeg).toBe(true);
});
