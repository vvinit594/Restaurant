/**
 * Admin dashboard stats — PostgreSQL aggregates.
 * GET /api/v1/admin/dashboard/stats
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

export async function getAdminDashboardStats() {
  return apiRequest('/admin/dashboard/stats', {
    method: 'GET',
    headers: authHeaders(),
  });
}
