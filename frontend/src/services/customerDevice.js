const PUBLIC_KEY = 'dilyum.device.publicId';
const SECRET_KEY = 'dilyum.device.secret';
const PUSH_DISMISS_KEY = 'dilyum.push.prompt.dismissedAt';

function canUseStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage;
  } catch {
    return false;
  }
}

export function getStoredDeviceCredentials() {
  if (!canUseStorage()) return null;
  const publicId = localStorage.getItem(PUBLIC_KEY);
  const secret = localStorage.getItem(SECRET_KEY);
  if (!publicId || !secret) return null;
  return { publicId, secret };
}

export function storeDeviceCredentials(publicId, secret) {
  if (!canUseStorage()) return;
  localStorage.setItem(PUBLIC_KEY, publicId);
  localStorage.setItem(SECRET_KEY, secret);
}

export function deviceHeaders() {
  const creds = getStoredDeviceCredentials();
  if (!creds) return {};
  return {
    'X-Device-Id': creds.publicId,
    'X-Device-Secret': creds.secret,
  };
}

export function wasPushPromptDismissed() {
  if (!canUseStorage()) return false;
  const raw = localStorage.getItem(PUSH_DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return true;
  return Date.now() - at < 14 * 24 * 60 * 60 * 1000;
}

export function dismissPushPrompt() {
  if (!canUseStorage()) return;
  localStorage.setItem(PUSH_DISMISS_KEY, String(Date.now()));
}

export function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function mintDeviceCredentials() {
  return {
    publicId: randomHex(16),
    secret: randomHex(32),
  };
}
