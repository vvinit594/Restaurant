import { generateDeviceCredentials, hashDeviceSecret, secretsMatch } from './device-secret';

describe('device-secret', () => {
  it('hashes the same secret consistently and rejects a different secret', () => {
    const { secret } = generateDeviceCredentials();
    const hash = hashDeviceSecret(secret);
    expect(secretsMatch(secret, hash)).toBe(true);
    expect(secretsMatch(secret + 'x', hash)).toBe(false);
  });
});
