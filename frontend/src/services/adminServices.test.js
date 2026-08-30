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

test('updateRestaurant PATCHes admin restaurants and returns updated entity', async () => {
  await adminLogin({
    email: 'vvinit594@gmail.com',
    password: 'Admin@123',
  });

  global.fetch = jest.fn(async (url, options = {}) => {
    const path = String(url);
    const json = (status, body) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    });
    if (path.includes('/admin/restaurants/rest_1') && options.method === 'PATCH') {
      const body = JSON.parse(options.body || '{}');
      expect(body.name).toBe('Updated Cafe');
      expect(body.description).toBe('New description');
      expect(options.headers?.Authorization).toContain('test_jwt');
      return json(200, {
        id: 'rest_1',
        name: body.name,
        slug: body.slug || 'updated-cafe',
        description: body.description,
        phone: body.phone,
        email: body.email,
        address: body.address,
        city: body.city,
        state: body.state || '',
        pincode: body.pincode || '',
        logoUrl: '',
        coverUrl: '',
        status: 'active',
        admin: body.admin
          ? { ...body.admin, id: 'owner_1', status: 'active', role: 'RESTAURANT_OWNER' }
          : null,
      });
    }
    return json(404, { message: 'Not found' });
  });

  const { updateRestaurant } = await import('./restaurantsApi');
  const updated = await updateRestaurant('rest_1', {
    name: 'Updated Cafe',
    slug: 'updated-cafe',
    description: 'New description',
    phone: '9999999999',
    email: 'cafe@example.com',
    address: '1 Main St',
    city: 'Hyderabad',
    state: 'TS',
    pincode: '500001',
    admin: { name: 'Owner', email: 'owner@example.com', phone: '888' },
  });
  expect(updated.name).toBe('Updated Cafe');
  expect(updated.description).toBe('New description');
});
