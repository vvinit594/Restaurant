const PUBLIC_KEY = 'dilyum.device.publicId';
const SECRET_KEY = 'dilyum.device.secret';
const PUSH_SESSION_DISMISS_KEY = 'dilyum.push.prompt.sessionDismissed';
const PUSH_DENIED_HINT_KEY = 'dilyum.push.deniedHint.dismissed';

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

function sessionStore() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Maybe Later lasts for this browser tab session, then the prompt can return. */
export function wasPushPromptDismissed() {
  const store = sessionStore();
  if (!store) return false;
  return store.getItem(PUSH_SESSION_DISMISS_KEY) === '1';
}

export function dismissPushPrompt() {
  const store = sessionStore();
  if (!store) return;
  store.setItem(PUSH_SESSION_DISMISS_KEY, '1');
}

export function wasDeniedHintDismissed() {
  const store = sessionStore();
  if (!store) return false;
  return store.getItem(PUSH_DENIED_HINT_KEY) === '1';
}

export function dismissDeniedHint() {
  const store = sessionStore();
  if (!store) return;
  store.setItem(PUSH_DENIED_HINT_KEY, '1');
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
