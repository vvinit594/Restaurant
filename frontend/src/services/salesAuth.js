/**
 * Sales Person auth — POST /api/v1/auth/sales/login
 */
import { apiRequest } from './apiClient';

const PREFIX = 'dilyum_sales_';
const SESSION_KEY = 'session';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

function removeKey(key) {
  localStorage.removeItem(PREFIX + key);
}

export async function salesLogin({ email, password }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !password) {
    const err = new Error('Email and password are required.');
    err.code = 'VALIDATION';
    throw err;
  }

  const data = await apiRequest('/auth/sales/login', {
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
    salesPerson: data.salesPerson || null,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  };
  writeJson(SESSION_KEY, session);
  return session;
}

export function getSalesSessionSync() {
  const session = readJson(SESSION_KEY, null);
  if (!session?.token || !session?.user) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) {
    removeKey(SESSION_KEY);
    return null;
  }
  return session;
}

export async function getSalesSession() {
  const local = getSalesSessionSync();
  if (!local?.token) return null;

  try {
    const me = await apiRequest('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${local.token}` },
    });
    if (me.role !== 'SALES_PERSON') {
      removeKey(SESSION_KEY);
      return null;
    }
    const session = {
      token: local.token,
      user: {
        id: me.id,
        email: me.email,
        name: me.name,
        role: me.role,
      },
      salesPerson: me.salesPerson || local.salesPerson || null,
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

export async function salesLogout() {
  const local = getSalesSessionSync();
  try {
    if (local?.token) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${local.token}` },
      });
    }
  } catch {
    /* ignore */
  }
  removeKey(SESSION_KEY);
}
