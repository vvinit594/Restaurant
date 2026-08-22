/**
 * Media upload service — NestJS-ready.
 * Target: POST /api/v1/media/upload
 * Response: { url, storageKey }
 *
 * Mock: stores a data URL (never a device file path).
 */

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/*,.jpg,.jpeg,.png,.webp';
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_ERROR =
  'Image must be JPG, PNG, or WEBP and smaller than 5 MB.';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

/**
 * Frontend validation. Backend must repeat this independently.
 * @param {File} file
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateImageFile(file) {
  if (!file || !(file instanceof File)) {
    return { ok: false, message: IMAGE_ERROR };
  }
  const typeOk = ALLOWED_TYPES.has(file.type);
  const extOk = ALLOWED_EXT.test(file.name || '');
  if (!typeOk && !extOk) {
    return { ok: false, message: IMAGE_ERROR };
  }
  // Reject SVG even if mislabeled
  if (/\.svg$/i.test(file.name || '') || file.type === 'image/svg+xml') {
    return { ok: false, message: IMAGE_ERROR };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, message: IMAGE_ERROR };
  }
  return { ok: true };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Upload image → public URL + storage key.
 * Swap body for real fetch to POST /api/v1/media/upload with FormData.
 *
 * @param {File} file
 * @param {{ folder?: string }} [options]
 * @returns {Promise<{ url: string, storageKey: string }>}
 */
export async function uploadImage(file, options = {}) {
  const check = validateImageFile(file);
  if (!check.ok) {
    const err = new Error(check.message);
    err.code = 'VALIDATION';
    throw err;
  }

  // --- replace with: ---
  // const form = new FormData();
  // form.append('file', file);
  // if (options.folder) form.append('folder', options.folder);
  // const res = await fetch('/api/v1/media/upload', { method: 'POST', body: form, credentials: 'include' });
  // if (!res.ok) throw new Error(...);
  // return res.json();

  const dataUrl = await readAsDataUrl(file);
  const ext = (file.name.match(/\.(jpe?g|png|webp)$/i) || ['', 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
  const folder = options.folder || 'uploads';
  const storageKey = `${folder}/${uid('img')}.${ext}`;

  return {
    url: dataUrl,
    storageKey,
  };
}

/**
 * Prefer uploaded file over pasted URL. Never returns a device path.
 * @param {{ url?: string, file?: File | null }} source
 * @param {{ folder?: string }} [options]
 * @returns {Promise<string>}
 */
export async function resolveImageUrl(source, options) {
  if (source?.file) {
    const uploaded = await uploadImage(source.file, options);
    return uploaded.url;
  }
  return String(source?.url || '').trim();
}
