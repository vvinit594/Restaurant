/**
 * QR APIs — admin + restaurant portal.
 */
import { getAdminSessionSync } from './adminAuth';
import { apiRequest } from './apiClient';
import { getRestaurantSessionSync } from './restaurantAuth';

function adminHeaders() {
  const session = getAdminSessionSync();
  if (!session?.token) {
    const err = new Error('Super Admin access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

function restaurantHeaders() {
  const session = getRestaurantSessionSync();
  if (!session?.token) {
    const err = new Error('Restaurant login required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

/** GET /api/v1/admin/qr */
export async function getAdminQrList() {
  return apiRequest('/admin/qr', { method: 'GET', headers: adminHeaders() });
}

/** POST /api/v1/admin/qr/backfill — idempotent missing QR creation */
export async function backfillAdminQr() {
  return apiRequest('/admin/qr/backfill', {
    method: 'POST',
    headers: adminHeaders(),
  });
}

export async function getAdminRestaurantQr(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}/qr`, {
    method: 'GET',
    headers: adminHeaders(),
  });
}

export async function regenerateAdminRestaurantQr(restaurantId) {
  return apiRequest(`/admin/restaurants/${restaurantId}/qr/regenerate`, {
    method: 'POST',
    headers: adminHeaders(),
  });
}

/** GET /api/v1/restaurants/me/qr */
export async function getMyRestaurantQr() {
  return apiRequest('/restaurants/me/qr', {
    method: 'GET',
    headers: restaurantHeaders(),
  });
}

export async function regenerateMyRestaurantQr() {
  return apiRequest('/restaurants/me/qr/regenerate', {
    method: 'POST',
    headers: restaurantHeaders(),
  });
}

/** GET /api/v1/public/qr/:token?slug= */
export async function resolvePublicQr(token, slug) {
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  const qs = params.toString();
  return apiRequest(
    `/public/qr/${encodeURIComponent(token)}${qs ? `?${qs}` : ''}`,
  );
}
