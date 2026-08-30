/**
 * Media upload — binary file → POST /api/v1/media/upload → Supabase Storage URL.
 * Never converts images to Base64 for persistence.
 */
import { getAdminSessionSync } from './adminAuth';
import { apiRequest } from './apiClient';
import { getRestaurantSessionSync } from './restaurantAuth';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/*,.jpg,.jpeg,.png,.webp';
/** Stay under Vercel serverless body limit (~4.5MB). */
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_ERROR_FORMAT =
  'Unsupported image format. Please upload JPG, PNG, or WebP.';
export const IMAGE_ERROR_SIZE = 'Image must be smaller than 4MB.';
/** Generic fallback used by older callers/tests. */
export const IMAGE_ERROR = IMAGE_ERROR_FORMAT;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

/**
 * Frontend validation. Backend repeats this independently.
 * @param {File} file
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateImageFile(file) {
  if (!file || !(file instanceof File)) {
    return { ok: false, message: IMAGE_ERROR_FORMAT };
  }
  if (/\.svg$/i.test(file.name || '') || file.type === 'image/svg+xml') {
    return { ok: false, message: IMAGE_ERROR_FORMAT };
  }
  const typeOk = ALLOWED_TYPES.has(file.type);
  const extOk = ALLOWED_EXT.test(file.name || '');
  if (!typeOk && !extOk) {
    return { ok: false, message: IMAGE_ERROR_FORMAT };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, message: IMAGE_ERROR_SIZE };
  }
  return { ok: true };
}

export function isHttpImageUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function authHeaders(options = {}) {
  const token =
    options.token ||
    getAdminSessionSync()?.token ||
    getRestaurantSessionSync()?.token;
  if (!token) {
    const err = new Error('Please sign in to upload images.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Upload binary File to backend → Supabase Storage.
 * @param {File} file
 * @param {{ folder?: string, kind?: string, restaurantId?: string, dishId?: string, token?: string }} [options]
 * @returns {Promise<{ url: string, storageKey: string }>}
 */
export async function uploadImage(file, options = {}) {
  const check = validateImageFile(file);
  if (!check.ok) {
    const err = new Error(check.message);
    err.code = 'VALIDATION';
    throw err;
  }

  const form = new FormData();
  form.append('file', file);
  if (options.folder) form.append('folder', options.folder);
  if (options.kind) form.append('kind', options.kind);
  if (options.restaurantId) form.append('restaurantId', options.restaurantId);
  if (options.dishId) form.append('dishId', options.dishId);

  const data = await apiRequest('/media/upload', {
    method: 'POST',
    headers: authHeaders(options),
    body: form,
  });

  const url = String(data?.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('Upload succeeded but no image URL was returned.');
  }

  return {
    url,
    storageKey: String(data?.storageKey || ''),
  };
}

/**
 * Prefer uploaded file over pasted URL.
 * Does NOT re-upload or migrate legacy data: URLs (that can exceed Vercel
 * body limits and surface as CORS "Failed to fetch"). Use the migration script.
 *
 * @param {{ url?: string, file?: File | null }} source
 * @param {{ folder?: string, kind?: string, restaurantId?: string, dishId?: string, token?: string }} [options]
 * @returns {Promise<string>}
 */
export async function resolveImageUrl(source, options) {
  if (source?.file) {
    const uploaded = await uploadImage(source.file, options);
    return uploaded.url;
  }
  return String(source?.url || '').trim();
}

/**
 * Build image field for a PATCH payload:
 * - new File → upload, return Storage URL
 * - https URL → keep
 * - empty → clear (empty string)
 * - legacy data: / other → omit (undefined) so DB row is left unchanged
 *
 * @param {{ url?: string, file?: File | null }} source
 * @param {object} [options]
 * @returns {Promise<string|undefined>}
 */
export async function resolveImageUrlForSave(source, options) {
  if (source?.file) {
    const uploaded = await uploadImage(source.file, options);
    return uploaded.url;
  }
  const url = String(source?.url || '').trim();
  if (!url) return '';
  if (isHttpImageUrl(url)) return url;
  return undefined;
}
