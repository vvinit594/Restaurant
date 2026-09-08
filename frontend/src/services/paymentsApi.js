/**
 * Razorpay billing APIs — restaurant portal + Super Admin.
 */
import { apiRequest } from './apiClient';
import { getAdminSessionSync } from './adminAuth';
import { getRestaurantSessionSync } from './restaurantAuth';

function restaurantAuthHeaders() {
  const session = getRestaurantSessionSync();
  if (!session?.token) {
    const err = new Error('Restaurant access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

function adminAuthHeaders() {
  const session = getAdminSessionSync();
  if (!session?.token) {
    const err = new Error('Super Admin access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

export async function getRestaurantBilling() {
  return apiRequest('/payments/restaurant/billing', {
    method: 'GET',
    headers: restaurantAuthHeaders(),
  });
}

export async function startRestaurantCheckout() {
  return apiRequest('/payments/restaurant/checkout', {
    method: 'POST',
    headers: restaurantAuthHeaders(),
  });
}

export async function getAdminRestaurantBilling(restaurantId) {
  return apiRequest(
    `/payments/admin/restaurants/${encodeURIComponent(restaurantId)}/billing`,
    {
      method: 'GET',
      headers: adminAuthHeaders(),
    },
  );
}

export async function startAdminRestaurantCheckout(restaurantId) {
  return apiRequest(
    `/payments/admin/restaurants/${encodeURIComponent(restaurantId)}/checkout`,
    {
      method: 'POST',
      headers: adminAuthHeaders(),
    },
  );
}
