import { apiRequest } from './apiClient';
import { deviceHeaders } from './customerDevice';
import {
  getRestaurantSessionSync,
  requirePermission,
  requireRestaurantSession,
} from './restaurantAuth';

function authHeaders() {
  const session = getRestaurantSessionSync();
  if (!session?.token) {
    const err = new Error('Restaurant login required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

export async function getPublicRestaurantTables(slug) {
  return apiRequest(
    `/public/restaurants/${encodeURIComponent(slug)}/tables`,
    { method: 'GET' },
  );
}

export async function placePublicOrder(slug, payload) {
  return apiRequest(
    `/public/restaurants/${encodeURIComponent(slug)}/orders`,
    {
      method: 'POST',
      headers: deviceHeaders(),
      body: JSON.stringify(payload),
    },
  );
}

export async function getRestaurantOrders(params = {}) {
  requireRestaurantSession(getRestaurantSessionSync());
  const qs = new URLSearchParams();
  if (params.active) qs.set('active', '1');
  if (params.history) qs.set('history', '1');
  if (params.status) qs.set('status', params.status);
  if (params.since) qs.set('since', params.since);
  if (params.take) qs.set('take', String(params.take));
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiRequest(`/restaurants/me/orders${q ? `?${q}` : ''}`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function getRestaurantOrder(orderId) {
  requireRestaurantSession(getRestaurantSessionSync());
  return apiRequest(`/restaurants/me/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function updateRestaurantOrderStatus(orderId, status) {
  requirePermission(getRestaurantSessionSync(), 'manageOrders');
  return apiRequest(
    `/restaurants/me/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    },
  );
}

/** Fetch persistent KOT payload (only after accept). */
export async function getRestaurantOrderKot(orderId) {
  requirePermission(getRestaurantSessionSync(), 'manageOrders');
  return apiRequest(
    `/restaurants/me/orders/${encodeURIComponent(orderId)}/kot`,
    {
      method: 'GET',
      headers: authHeaders(),
    },
  );
}
