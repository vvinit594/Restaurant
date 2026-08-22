/**
 * Admin auth against NestJS API.
 * POST /api/v1/auth/admin/login
 * GET  /api/v1/auth/me
 * POST /api/v1/auth/logout
 */
import { readJson, removeKey, writeJson } from './adminStorage';
import { apiRequest } from './apiClient';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  RESTAURANT_ADMIN: 'RESTAURANT_ADMIN',
};

const SESSION_KEY = 'session';

/**
 * Authenticate Super Admin via backend.
 */
export async function adminLogin({ email, password }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !password) {
    const err = new Error('Email and password are required.');
    err.code = 'VALIDATION';
    throw err;
  }

  const data = await apiRequest('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: normalized, password }),
  });

  const session = {
    token: data.accessToken,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
    },
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  };
  writeJson(SESSION_KEY, session);
  return session;
}

export async function getAdminSession() {
  const local = getAdminSessionSync();
  if (!local?.token) return null;

  try {
    const me = await apiRequest('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${local.token}` },
    });
    const session = {
      token: local.token,
      user: {
        id: me.id,
        email: me.email,
        name: me.name,
        role: me.role,
      },
      expiresAt: local.expiresAt || Date.now() + 1000 * 60 * 60 * 12,
    };
    writeJson(SESSION_KEY, session);
    return session;
  } catch (err) {
    if (err.code === 'UNAUTHORIZED' || err.code === 'FORBIDDEN') {
      removeKey(SESSION_KEY);
      return null;
    }
    return local;
  }
}

export function getAdminSessionSync() {
  const session = readJson(SESSION_KEY, null);
  if (!session?.token || !session?.user) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) {
    removeKey(SESSION_KEY);
    return null;
  }
  return session;
}

export async function adminLogout() {
  const local = getAdminSessionSync();
  try {
    if (local?.token) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${local.token}` },
      });
    }
  } catch {
    // Ignore network/API errors; always clear local session
  }
  removeKey(SESSION_KEY);
}

export function requireSuperAdmin(session) {
  if (!session?.user || session.user.role !== ROLES.SUPER_ADMIN) {
    const err = new Error('Super Admin access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
}
