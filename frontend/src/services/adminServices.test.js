/**
 * @jest-environment node
 */
import { webcrypto } from 'crypto';
import { adminLogin, adminLogout, getAdminSession, ROLES } from './adminAuth';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const store = new Map();

const mockAdmin = {
  id: 'user_super_admin',
  email: 'vvinit594@gmail.com',
  name: 'Platform Super Admin',
  role: ROLES.SUPER_ADMIN,
};

beforeAll(() => {
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

beforeEach(() => {
  store.clear();
  global.fetch = jest.fn(async (url, options = {}) => {
    const path = String(url);
    const json = (status, body) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    });

    if (path.includes('/auth/admin/login') && options.method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      if (body.email === mockAdmin.email && body.password === 'Admin@123') {
        return json(200, { accessToken: 'test_jwt', user: mockAdmin });
      }
      return json(401, { message: 'Invalid email or password.' });
    }

    if (path.includes('/auth/me')) {
      const auth = options.headers?.Authorization || '';
      if (String(auth).includes('test_jwt')) {
        return json(200, mockAdmin);
      }
      return json(401, { message: 'Authentication required.' });
    }

    if (path.includes('/auth/logout')) {
      return json(200, { success: true });
    }

    if (path.includes('/admin/restaurants') && options.method === 'GET') {
      return json(200, []);
    }

    return json(404, { message: 'Not found' });
  });
});

test('super admin login stores session and can load empty restaurants', async () => {
  await expect(adminLogin({ email: 'bad@x.com', password: 'x' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  });

  const session = await adminLogin({
    email: 'vvinit594@gmail.com',
    password: 'Admin@123',
  });
  expect(session.user.role).toBe(ROLES.SUPER_ADMIN);
  expect(await getAdminSession()).toBeTruthy();

  const { getRestaurants } = await import('./restaurantsApi');
  const list = await getRestaurants();
  expect(list).toEqual([]);

  await adminLogout();
  expect(await getAdminSession()).toBeNull();
});
