/**
 * Sales Person API — /api/v1/sales/*
 */
import { apiRequest } from './apiClient';
import { getSalesSessionSync } from './salesAuth';
import { slugify } from './adminStorage';

function authHeaders() {
  const session = getSalesSessionSync();
  if (!session?.token) {
    const err = new Error('Sales Person access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

export async function getSalesDashboard() {
  return apiRequest('/sales/dashboard', { method: 'GET', headers: authHeaders() });
}

export async function getSalesAnalytics(range = 'all') {
  const qs = range ? `?range=${encodeURIComponent(range)}` : '';
  return apiRequest(`/sales/analytics${qs}`, { method: 'GET', headers: authHeaders() });
}

export async function getSalesCommission() {
  return apiRequest('/sales/commission', { method: 'GET', headers: authHeaders() });
}

export async function getSalesPlans() {
  return apiRequest('/sales/plans', { method: 'GET', headers: authHeaders() });
}

export async function getSalesRestaurants() {
  return apiRequest('/sales/restaurants', { method: 'GET', headers: authHeaders() });
}

export async function getSalesRestaurant(id) {
  return apiRequest(`/sales/restaurants/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function createSalesRestaurant(payload) {
  const restaurant = payload.restaurant || payload;
  const owner = payload.owner || payload.admin;
  const plan =
    payload.subscriptionPlan ||
    payload.subscription?.plan ||
    payload.subscriptionPlanId ||
    'trial_10_days';

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

  return apiRequest('/sales/restaurants', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function getSalesQr() {
  return apiRequest('/sales/qr', { method: 'GET', headers: authHeaders() });
}

export async function getSalesLeads() {
  return apiRequest('/sales/leads', { method: 'GET', headers: authHeaders() });
}

export async function createSalesLead(payload) {
  return apiRequest('/sales/leads', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateSalesLead(id, payload) {
  return apiRequest(`/sales/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getSalesProfile() {
  return apiRequest('/sales/profile', { method: 'GET', headers: authHeaders() });
}

export async function updateSalesProfile(payload) {
  return apiRequest('/sales/profile', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}
