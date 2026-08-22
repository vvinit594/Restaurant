import { apiRequest } from './apiClient';

/** Portal path segments that must not be treated as public restaurant slugs. */
export const RESERVED_RESTAURANT_PATHS = new Set([
  'dashboard',
  'menu',
  'profile',
  'settings',
  'categories',
  'ingredients',
  'tables',
  'qr',
  'analytics',
  'login',
]);

/**
 * Active restaurants for customer discovery.
 * GET /api/v1/public/restaurants
 */
export async function getPublicRestaurants({ search = '' } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return apiRequest(`/public/restaurants${qs ? `?${qs}` : ''}`);
}

/**
 * Restaurant profile + published menu by slug.
 * GET /api/v1/public/restaurants/:slug
 */
export async function getPublicRestaurantBySlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();

  if (!normalized || RESERVED_RESTAURANT_PATHS.has(normalized)) {
    const err = new Error('Restaurant not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return apiRequest(`/public/restaurants/${encodeURIComponent(normalized)}`);
}
