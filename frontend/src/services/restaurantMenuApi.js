/**
 * Restaurant menu API — NestJS + PostgreSQL (tenant-scoped via JWT).
 * GET/POST/PATCH/DELETE /api/v1/restaurants/me/dishes
 * GET /api/v1/restaurants/me/categories
 */
import {
  getRestaurantSessionSync,
  requirePermission,
  requireRestaurantSession,
} from './restaurantAuth';
import { apiRequest } from './apiClient';

function authHeaders() {
  const session = getRestaurantSessionSync();
  if (!session?.token) {
    const err = new Error('Restaurant login required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return { Authorization: `Bearer ${session.token}` };
}

async function withSession(permissionKey) {
  const session = getRestaurantSessionSync();
  if (permissionKey) requirePermission(session, permissionKey);
  else requireRestaurantSession(session);
  return session;
}

function optionalNumber(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Full create body (all primary fields). */
function toDishPayload(payload) {
  const body = {
    name: String(payload.name || '').trim(),
    price: Number(payload.price),
    category: String(payload.category || '').trim() || undefined,
    categoryId: payload.categoryId || undefined,
    description: String(payload.description || '').trim() || undefined,
    imageUrl: String(payload.imageUrl || '').trim() || undefined,
    calories: optionalNumber(payload.calories),
    protein: optionalNumber(payload.protein),
    carbohydrates: optionalNumber(payload.carbohydrates),
    fat: optionalNumber(payload.fat),
    ingredients: payload.ingredients,
    allergens: payload.allergens,
    isVeg: Boolean(payload.isVeg),
    isVegan: Boolean(payload.isVegan),
    isJain: Boolean(payload.isJain),
    available: payload.available !== false,
    published: payload.published !== false,
  };
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });
  return body;
}

/**
 * Partial PATCH body — only keys present on `payload`.
 * Avoids sending price:null / forced booleans that break Prisma on toggles.
 */
function toDishUpdatePayload(payload) {
  const body = {};
  if (payload.name !== undefined) body.name = String(payload.name || '').trim();
  if (payload.price !== undefined) {
    const price = optionalNumber(payload.price);
    if (price !== undefined) body.price = price;
  }
  if (payload.category !== undefined) {
    body.category = String(payload.category || '').trim() || undefined;
  }
  if (payload.categoryId !== undefined) body.categoryId = payload.categoryId || undefined;
  if (payload.description !== undefined) {
    body.description = String(payload.description || '').trim();
  }
  if (payload.imageUrl !== undefined) {
    body.imageUrl = String(payload.imageUrl || '').trim() || undefined;
  }
  if (payload.calories !== undefined) body.calories = optionalNumber(payload.calories);
  if (payload.protein !== undefined) body.protein = optionalNumber(payload.protein);
  if (payload.carbohydrates !== undefined) {
    body.carbohydrates = optionalNumber(payload.carbohydrates);
  }
  if (payload.fat !== undefined) body.fat = optionalNumber(payload.fat);
  if (payload.ingredients !== undefined) body.ingredients = payload.ingredients;
  if (payload.allergens !== undefined) body.allergens = payload.allergens;
  if (payload.isVeg !== undefined) body.isVeg = Boolean(payload.isVeg);
  if (payload.isVegan !== undefined) body.isVegan = Boolean(payload.isVegan);
  if (payload.isJain !== undefined) body.isJain = Boolean(payload.isJain);
  if (payload.available !== undefined) body.available = Boolean(payload.available);
  if (payload.published !== undefined) body.published = Boolean(payload.published);
  if (payload.isAvailable !== undefined) body.isAvailable = Boolean(payload.isAvailable);
  if (payload.isPublished !== undefined) body.isPublished = Boolean(payload.isPublished);

  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });
  return body;
}

/**
 * Public menus come from GET /api/v1/public/restaurants/:slug.
 * Kept for callers that still pass restaurantId — returns empty until wired via slug API.
 */
export function getPublishedMenuByRestaurantId() {
  return { categories: [], dishes: [] };
}

export async function getRestaurantProfile() {
  await withSession();
  return apiRequest('/restaurants/me', {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function updateRestaurantProfile(payload) {
  await withSession('manageProfile');
  const body = { ...payload };
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });
  return apiRequest('/restaurants/me', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function getCategories() {
  await withSession('viewMenu');
  const categories = await apiRequest('/restaurants/me/categories', {
    method: 'GET',
    headers: authHeaders(),
  });
  return (categories || []).map((c) => (typeof c === 'string' ? c : c.name));
}

export async function createCategory(name) {
  await withSession('manageCategories');
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    const err = new Error('Category name is required.');
    err.code = 'VALIDATION';
    throw err;
  }
  // Categories are find-or-created on dish save; refresh list after ensure.
  const categories = await getCategories();
  if (!categories.includes(trimmed)) {
    return [...categories, trimmed];
  }
  return categories;
}

export async function getRestaurantMenu({
  search = '',
  category = 'all',
  status = 'all',
} = {}) {
  await withSession('viewMenu');
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category && category !== 'all') params.set('category', category);
  const qs = params.toString();
  let dishes = await apiRequest(`/restaurants/me/dishes${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (status === 'active') {
    dishes = dishes.filter((d) => d.available && d.published);
  } else if (status === 'unavailable') {
    dishes = dishes.filter((d) => !d.available);
  } else if (status === 'draft') {
    dishes = dishes.filter((d) => !d.published);
  }

  return dishes;
}

export async function getMenuItem(dishId) {
  await withSession('viewMenu');
  return apiRequest(`/restaurants/me/dishes/${encodeURIComponent(dishId)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
}

export async function createMenuItem(payload) {
  await withSession('addDish');
  return apiRequest('/restaurants/me/dishes', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(toDishPayload(payload)),
  });
}

/**
 * Authoritative bulk validation (no DB writes). Max 50 dishes per call.
 * @param {object[]} dishes
 */
export async function validateBulkDishes(dishes) {
  await withSession('addDish');
  return apiRequest('/restaurants/me/dishes/bulk/validate', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dishes }),
  });
}

/**
 * Bulk create dishes for the authenticated restaurant only.
 * Images must already be HTTPS storage URLs (not Base64).
 * @param {object[]} dishes
 */
export async function bulkCreateDishes(dishes) {
  await withSession('addDish');
  return apiRequest('/restaurants/me/dishes/bulk', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dishes }),
  });
}

export async function updateMenuItem(dishId, payload) {
  await withSession('editDish');
  return apiRequest(`/restaurants/me/dishes/${encodeURIComponent(dishId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(toDishUpdatePayload(payload)),
  });
}

export async function deleteMenuItem(dishId) {
  await withSession('deleteDish');
  await apiRequest(`/restaurants/me/dishes/${encodeURIComponent(dishId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return true;
}

export async function getRestaurantTables() {
  await withSession('manageTables');
  return [];
}

export async function getRestaurantQRCodes() {
  await withSession('manageQr');
  return [];
}

export async function getRestaurantDashboardStats() {
  await withSession('viewDashboard');
  return apiRequest('/restaurants/me/dashboard', {
    method: 'GET',
    headers: authHeaders(),
  });
}
