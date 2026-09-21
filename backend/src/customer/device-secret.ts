import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashDeviceSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function secretsMatch(plain: string, storedHash: string): boolean {
  const incoming = Buffer.from(hashDeviceSecret(plain), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

export function generateDeviceCredentials() {
  return {
    publicId: randomBytes(16).toString('hex'),
    secret: randomBytes(32).toString('hex'),
  };
}

export function isLikelyDevicePublicId(value: string): boolean {
  return /^[a-f0-9]{16,64}$/i.test(String(value || '').trim());
}

export function isLikelyDeviceSecret(value: string): boolean {
  return /^[a-f0-9]{32,128}$/i.test(String(value || '').trim());
}
