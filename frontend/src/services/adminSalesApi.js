/**
 * Super Admin — Sales Persons API
 * GET/POST /api/v1/admin/sales-persons
 * GET /api/v1/admin/sales-persons/:id
 * PATCH /api/v1/admin/sales-persons/:id/status
 */
import { getAdminSessionSync } from './adminAuth';
import { apiRequest } from './apiClient';

function authHeaders() {
  const session = getAdminSessionSync();
  if (!session?.token) {
    const err = new Error('Super Admin access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

export async function getAdminSalesPersons() {
  return apiRequest('/admin/sales-persons', {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function getAdminSalesPerson(id) {
  return apiRequest(`/admin/sales-persons/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function createAdminSalesPerson(payload) {
  return apiRequest('/admin/sales-persons', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: String(payload.name || '').trim(),
      email: String(payload.email || '').trim().toLowerCase(),
      phone: String(payload.phone || '').trim(),
      password: String(payload.password || ''),
    }),
  });
}

export async function getAdminSalesPersonPendingLeads(id) {
  return apiRequest(`/admin/sales-persons/${encodeURIComponent(id)}/pending-leads`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function setAdminSalesPersonStatus(id, status) {
  return apiRequest(`/admin/sales-persons/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
}
