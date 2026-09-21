import { apiRequest } from './apiClient';
import { deviceHeaders } from './customerDevice';

function withDevice(options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...deviceHeaders(),
    },
  };
}

export function registerCustomerDevice(payload) {
  return apiRequest('/customer/device/register', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export function getPushConfig() {
  return apiRequest('/customer/push/config', { method: 'GET' });
}

export function getCustomerProfile() {
  return apiRequest('/customer/profile', withDevice({ method: 'GET' }));
}

export function updateCustomerProfile(payload) {
  return apiRequest(
    '/customer/profile',
    withDevice({ method: 'PATCH', body: JSON.stringify(payload) }),
  );
}

export function getCustomerOrders(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  return apiRequest(
    `/customer/orders${qs.toString() ? `?${qs}` : ''}`,
    withDevice({ method: 'GET' }),
  );
}

export function getCustomerLiveOrders(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  return apiRequest(
    `/customer/orders/live${qs.toString() ? `?${qs}` : ''}`,
    withDevice({ method: 'GET' }),
  );
}

export function getCustomerOrder(id) {
  return apiRequest(
    `/customer/orders/${encodeURIComponent(id)}`,
    withDevice({ method: 'GET' }),
  );
}

export function getCustomerTransactions(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  return apiRequest(
    `/customer/transactions${qs.toString() ? `?${qs}` : ''}`,
    withDevice({ method: 'GET' }),
  );
}

export function getCustomerCoupons(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  return apiRequest(
    `/customer/coupons${qs.toString() ? `?${qs}` : ''}`,
    withDevice({ method: 'GET' }),
  );
}

export function getCustomerNotifications(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  return apiRequest(
    `/customer/notifications${qs.toString() ? `?${qs}` : ''}`,
    withDevice({ method: 'GET' }),
  );
}

export function getUnreadNotificationCount() {
  return apiRequest('/customer/notifications/unread-count', withDevice({ method: 'GET' }));
}

export function markNotificationRead(id) {
  return apiRequest(
    `/customer/notifications/${encodeURIComponent(id)}/read`,
    withDevice({ method: 'PATCH' }),
  );
}

export function markAllNotificationsRead() {
  return apiRequest('/customer/notifications/read-all', withDevice({ method: 'POST' }));
}

export function recordRestaurantVisit(slug) {
  return apiRequest(
    `/customer/restaurants/${encodeURIComponent(slug)}/visit`,
    withDevice({ method: 'POST' }),
  );
}

export function savePushSubscription(payload) {
  return apiRequest(
    '/customer/device/push-subscription',
    withDevice({ method: 'POST', body: JSON.stringify(payload) }),
  );
}

export function deletePushSubscription(endpoint) {
  return apiRequest(
    '/customer/device/push-subscription',
    withDevice({ method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  );
}
