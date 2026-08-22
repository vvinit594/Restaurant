/**
 * Password hashing for mock/local storage.
 * Backend must hash with bcrypt (or argon2) server-side and never store plaintext.
 *
 * Stored format: sha256$<saltHex>$<digestHex>
 * (ponytail: browser SHA-256 + salt until NestJS bcrypt endpoint exists)
 */

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function getCrypto() {
  // Browser + Node (tests polyfill crypto on globalThis)
  // eslint-disable-next-line no-undef
  const c = globalThis.crypto;
  if (!c?.subtle || typeof c.getRandomValues !== 'function') {
    throw new Error('Web Crypto API is required for password hashing.');
  }
  return c;
}

export const PASSWORD_MIN_LENGTH = 8;

export function validatePasswordStrength(password) {
  if (!password || String(password).length < PASSWORD_MIN_LENGTH) {
    return 'Password must be at least 8 characters.';
  }
  return '';
}

export async function hashPassword(password) {
  const crypto = getCrypto();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toHex(saltBytes);
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return `sha256$${salt}$${toHex(digest)}`;
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash || typeof passwordHash !== 'string') return false;
  const parts = passwordHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'sha256') return false;
  const [, salt, expected] = parts;
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await getCrypto().subtle.digest('SHA-256', data);
  const actual = toHex(digest);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) {
    mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
