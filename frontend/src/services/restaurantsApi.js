/**
 * Admin restaurants API — NestJS + PostgreSQL.
 * POST/GET /api/v1/admin/restaurants
 */
import { getAdminSessionSync } from './adminAuth';
import { apiRequest } from './apiClient';
import { slugify } from './adminStorage';

export { slugify };

function authHeaders() {
  const session = getAdminSessionSync();
  if (!session?.token) {
    const err = new Error('Super Admin access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

export async function getSubscriptionPlans() {
  return apiRequest('/admin/restaurants/plans', {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function getRestaurants({ search = '', status = 'all' } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const qs = params.toString();
  return apiRequest(`/admin/restaurants${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function getRestaurant(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

/**
 * Create restaurant + owner + membership + subscription (transaction on backend).
 */
export async function createRestaurant(payload) {
  const restaurant = payload.restaurant || payload;
  const owner = payload.owner || payload.admin || {
    name: payload.adminName,
    email: payload.adminEmail,
    phone: payload.adminPhone,
    password: payload.adminPassword,
  };
  const plan =
    payload.subscriptionPlan ||
    payload.subscription?.plan ||
    payload.subscriptionPlanId ||
    'free';

  const body = {
    restaurant: {
      name: String(restaurant.name || '').trim(),
      slug: slugify(restaurant.slug || restaurant.name),
      description: restaurant.description || undefined,
      logoUrl: restaurant.logoUrl || undefined,
      coverImageUrl: restaurant.coverImageUrl || restaurant.coverUrl || undefined,
      phone: String(restaurant.phone || '').trim(),
      email: String(restaurant.email || '').trim().toLowerCase(),
      address: String(restaurant.address || '').trim(),
      city: String(restaurant.city || '').trim(),
      state: restaurant.state || undefined,
      pincode: restaurant.pincode || undefined,
    },
    admin: {
      name: String(owner.name || '').trim(),
      email: String(owner.email || '').trim().toLowerCase(),
      phone: owner.phone || undefined,
      password: owner.password,
    },
    subscriptionPlan: String(plan).toUpperCase(),
  };

  // Drop undefined keys so Nest optional validators behave cleanly
  Object.keys(body.restaurant).forEach((k) => {
    if (body.restaurant[k] === undefined || body.restaurant[k] === '') {
      delete body.restaurant[k];
    }
  });
  if (!body.admin.phone) delete body.admin.phone;

  const result = await apiRequest('/admin/restaurants', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  // Normalize for existing UI that expects restaurant entity with id at top level
  return {
    id: result.restaurant.id,
    name: result.restaurant.name,
    slug: result.restaurant.slug,
    status: String(result.restaurant.status || 'ACTIVE').toLowerCase(),
    ...result.restaurant,
    owner: result.owner,
    message: result.message,
  };
}

export async function suspendRestaurant(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}/suspend`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
}

export async function activateRestaurant(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}/activate`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
}

export async function deleteRestaurant(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

/** @deprecated No-op. Restaurants come only from PostgreSQL via Super Admin create. */
export function ensureRestaurantsSeeded() {
  return [];
}

export async function updateRestaurant(restaurantId, payload) {
  // Full update API is Phase 2+; keep shape for detail page until wired.
  const err = new Error('Restaurant update API will be available in the next phase.');
  err.code = 'NOT_IMPLEMENTED';
  throw err;
}
