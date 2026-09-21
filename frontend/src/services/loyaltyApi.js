import { apiRequest } from './apiClient';
import { getRestaurantSessionSync, requirePermission, requireRestaurantSession } from './restaurantAuth';

function authHeaders(permission) {
  const session = getRestaurantSessionSync();
  requireRestaurantSession(session);
  if (permission) requirePermission(session, permission);
  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export function getLoyaltyStats() {
  return apiRequest('/loyalty/stats', {
    method: 'GET',
    headers: authHeaders('viewLoyalty'),
  });
}

export function getLoyaltyCustomers(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  });
  return apiRequest(`/loyalty/customers${qs.toString() ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: authHeaders('viewLoyalty'),
  });
}

export function getLoyaltyCustomer(id) {
  return apiRequest(`/loyalty/customers/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders('viewLoyalty'),
  });
}

export function createLoyaltyCustomer(payload) {
  return apiRequest('/loyalty/customers', {
    method: 'POST',
    headers: authHeaders('manageLoyaltyCustomers'),
    body: JSON.stringify(payload),
  });
}

export function updateLoyaltyCustomer(id, payload) {
  return apiRequest(`/loyalty/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders('manageLoyaltyCustomers'),
    body: JSON.stringify(payload),
  });
}

export function deleteLoyaltyCustomer(id) {
  return apiRequest(`/loyalty/customers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders('manageLoyaltyCustomers'),
  });
}

export function sendLoyaltyWhatsappOffer(id, payload) {
  return apiRequest(`/loyalty/customers/${encodeURIComponent(id)}/send-whatsapp`, {
    method: 'POST',
    headers: authHeaders('sendLoyaltyOffers'),
    body: JSON.stringify(payload),
  });
}

export function getLoyaltyPrograms() {
  return apiRequest('/loyalty/programs', {
    method: 'GET',
    headers: authHeaders('viewLoyalty'),
  });
}

export function updateLoyaltyProgram(programType, payload) {
  return apiRequest(`/loyalty/programs/${encodeURIComponent(programType)}`, {
    method: 'PATCH',
    headers: authHeaders('manageLoyaltyPrograms'),
    body: JSON.stringify(payload),
  });
}

export function getEngagementCustomers(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  });
  return apiRequest(`/loyalty/engagement/customers${qs.toString() ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: authHeaders('viewLoyalty'),
  });
}

export function getEngagementCoupons() {
  return apiRequest('/loyalty/engagement/coupons', {
    method: 'GET',
    headers: authHeaders('viewLoyalty'),
  });
}

export function createEngagementCoupon(payload) {
  return apiRequest('/loyalty/engagement/coupons', {
    method: 'POST',
    headers: authHeaders('sendLoyaltyOffers'),
    body: JSON.stringify(payload),
  });
}

export function getEngagementCampaigns() {
  return apiRequest('/loyalty/engagement/campaigns', {
    method: 'GET',
    headers: authHeaders('viewLoyalty'),
  });
}

export function sendEngagementNotification(payload) {
  return apiRequest('/loyalty/engagement/notifications/send', {
    method: 'POST',
    headers: authHeaders('sendLoyaltyOffers'),
    body: JSON.stringify(payload),
  });
}
