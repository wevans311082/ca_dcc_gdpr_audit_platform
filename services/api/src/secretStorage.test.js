import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secretStorage.js';

describe('organization API key encryption', () => {
  it('round-trips secrets without storing their plaintext', () => {
    const encrypted = encryptSecret('sk-example-secret', 'stable-jwt-secret');

    expect(encrypted).not.toContain('sk-example-secret');
    expect(decryptSecret(encrypted, 'stable-jwt-secret')).toBe('sk-example-secret');
  });

  it('rejects decryption with a different encryption secret', () => {
    const encrypted = encryptSecret('sk-example-secret', 'stable-jwt-secret');

    expect(() => decryptSecret(encrypted, 'different-jwt-secret')).toThrow();
  });
});