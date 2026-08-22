/**
 * Restaurant portal auth against NestJS.
 * POST /api/v1/auth/restaurant/login
 */
import { readJson, removeKey, writeJson } from './adminStorage';
import { apiRequest } from './apiClient';
import { RESTAURANT_ROLES } from './restaurantAuthShared';

export { RESTAURANT_ROLES };

const SESSION_KEY = 'restaurant_session';

export function getPermissions(role) {
  const isOwner = role === RESTAURANT_ROLES.OWNER;
  const isManager = role === RESTAURANT_ROLES.MANAGER;
  const isStaff = role === RESTAURANT_ROLES.STAFF;

  return {
    viewDashboard: isOwner || isManager || isStaff,
    manageProfile: isOwner,
    manageSettings: isOwner,
    manageStaff: isOwner,
    viewMenu: isOwner || isManager || isStaff,
    addDish: isOwner || isManager || isStaff,
    editDish: isOwner || isManager || isStaff,
    deleteDish: isOwner || isManager,
    manageAvailability: isOwner || isManager || isStaff,
    manageCategories: isOwner || isManager,
    manageIngredients: isOwner || isManager,
    manageTables: isOwner || isManager,
    manageQr: isOwner || isManager,
    viewAnalytics: isOwner || isManager,
  };
}

function buildSession(data) {
  return {
    token: data.accessToken,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
      restaurantId: data.restaurant.id,
      restaurantSlug: data.restaurant.slug,
      restaurantName: data.restaurant.name,
    },
    restaurant: data.restaurant,
    permissions: getPermissions(data.user.role),
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  };
}

export async function restaurantLogin({ email, password }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !password) {
    const err = new Error('Email and password are required.');
    err.code = 'VALIDATION';
    throw err;
  }

  const data = await apiRequest('/auth/restaurant/login', {
    method: 'POST',
    body: JSON.stringify({ email: normalized, password }),
  });

  const session = buildSession(data);
  writeJson(SESSION_KEY, session);
  return session;
}

export async function getRestaurantSession() {
  const local = getRestaurantSessionSync();
  if (!local?.token) return null;

  try {
    const me = await apiRequest('/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${local.token}` },
    });

    // Keep a still-valid local session if /auth/me omits restaurant briefly
    // (stale JWT claim, etc.) instead of wiping the portal mid-navigation.
    if (!me?.restaurant?.id) {
      if (local.user?.restaurantId) return local;
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
        restaurantId: me.restaurant.id,
        restaurantSlug: me.restaurant.slug,
        restaurantName: me.restaurant.name,
      },
      restaurant: me.restaurant,
      permissions: getPermissions(me.role),
      expiresAt: local.expiresAt || Date.now() + 1000 * 60 * 60 * 12,
    };
    writeJson(SESSION_KEY, session);
    return session;
  } catch (err) {
    if (err.code === 'UNAUTHORIZED') {
      removeKey(SESSION_KEY);
      return null;
    }
    // Network / 5xx: keep local session so dashboard/menu keep working
    return local;
  }
}

export function getRestaurantSessionSync() {
  const session = readJson(SESSION_KEY, null);
  if (!session?.token || !session?.user?.restaurantId) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) {
    removeKey(SESSION_KEY);
    return null;
  }
  return {
    ...session,
    permissions: session.permissions || getPermissions(session.user.role),
  };
}

export async function restaurantLogout() {
  const local = getRestaurantSessionSync();
  try {
    if (local?.token) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${local.token}` },
      });
    }
  } catch {
    // always clear local
  }
  removeKey(SESSION_KEY);
}

export async function getCurrentRestaurantUser() {
  const session = await getRestaurantSession();
  if (!session) return null;
  return {
    user: session.user,
    restaurant: {
      id: session.user.restaurantId,
      slug: session.user.restaurantSlug,
      name: session.user.restaurantName,
    },
    role: session.user.role,
    permissions: session.permissions,
  };
}

export function requireRestaurantSession(session) {
  if (!session?.user?.restaurantId) {
    const err = new Error('Restaurant authentication required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

export function requirePermission(session, permissionKey) {
  requireRestaurantSession(session);
  const permissions = session.permissions || getPermissions(session.user.role);
  if (!permissions[permissionKey]) {
    const err = new Error('You do not have permission for this action.');
    err.code = 'FORBIDDEN';
    throw err;
  }
}
