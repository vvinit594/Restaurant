/**
 * Media upload — sign with API (JSON) → PUT file to Supabase Storage → public URL.
 * File bytes never go through the Nest/Vercel API (avoids multipart CORS/413 failures).
 */
import { getAdminSessionSync } from './adminAuth';
import { apiRequest } from './apiClient';
import { getRestaurantSessionSync } from './restaurantAuth';
import { getSalesSessionSync } from './salesAuth';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/*,.jpg,.jpeg,.png,.webp';
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const IMAGE_ERROR_FORMAT =
  'Unsupported image format. Please upload JPG, PNG, or WebP.';
export const IMAGE_ERROR_SIZE = 'Image must be smaller than 3MB.';
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
    getRestaurantSessionSync()?.token ||
    getSalesSessionSync()?.token;
  if (!token) {
    const err = new Error('Please sign in to upload images.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return { Authorization: `Bearer ${token}` };
}

function guessContentType(file) {
  const t = String(file?.type || '').toLowerCase();
  if (ALLOWED_TYPES.has(t)) return t;
  const name = String(file?.name || '');
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Upload binary File via signed Supabase URL (not through /media/upload multipart).
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

  const contentType = guessContentType(file);
  const signed = await apiRequest('/media/sign-upload', {
    method: 'POST',
    headers: authHeaders(options),
    body: JSON.stringify({
      folder: options.folder || undefined,
      kind: options.kind || undefined,
      restaurantId: options.restaurantId || undefined,
      dishId: options.dishId || undefined,
      contentType,
      fileName: file.name || 'upload.jpg',
      fileSize: file.size,
    }),
  });

  const uploadUrl = String(signed?.uploadUrl || '').trim();
  const publicUrl = String(signed?.publicUrl || signed?.url || '').trim();
  const storageKey = String(signed?.storageKey || signed?.path || '').trim();
  if (!uploadUrl || !publicUrl) {
    throw new Error('Upload signing failed — no storage URL returned.');
  }

  const putHeaders = {
    'Content-Type': contentType,
  };
  if (signed.token) {
    putHeaders.Authorization = `Bearer ${signed.token}`;
  }

  let putRes;
  try {
    putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: putHeaders,
      body: file,
    });
  } catch {
    const err = new Error(
      'Could not upload image to storage. Check your network and try again.',
    );
    err.code = 'NETWORK';
    throw err;
  }

  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '');
    const err = new Error(
      detail || `Storage upload failed (${putRes.status}).`,
    );
    err.code = 'VALIDATION';
    throw err;
  }

  return {
    url: publicUrl,
    storageKey,
  };
}

/**
 * Prefer uploaded file over pasted URL.
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
 * Build image field for a PATCH/create payload:
 * - new File → signed upload → Storage URL
 * - https URL → keep
 * - empty → clear
 * - legacy data: → omit (undefined)
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
