import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  decryptSecretString,
  encryptSecret,
  encryptSecretString,
  isEncryptionConfigured,
  maskKey,
  safeDecryptSecret,
} from '@/lib/crypto/encrypt';

/**
 * The encryption layer is the one place where a bug is both silent and
 * catastrophic — a tampered ciphertext must fail loudly, not decrypt to garbage.
 */
describe('secret encryption', () => {
  it('round-trips a key', () => {
    const plaintext = 'sk-test-abcdefghijklmnopqrstuvwxyz0123456789';
    const sealed = encryptSecret(plaintext);

    expect(sealed.encryptedKey).not.toContain(plaintext);
    expect(sealed.iv.length).toBeGreaterThan(0);
    expect(sealed.tag.length).toBeGreaterThan(0);
    expect(decryptSecret(sealed)).toBe(plaintext);
  });

  it('produces a different ciphertext for the same input (unique IV per row)', () => {
    const a = encryptSecret('same-secret-value');
    const b = encryptSecret('same-secret-value');
    expect(a.iv).not.toBe(b.iv);
    expect(a.encryptedKey).not.toBe(b.encryptedKey);
  });

  it('rejects a tampered auth tag', () => {
    const sealed = encryptSecret('sensitive-value');
    // Flip a byte in the tag: GCM must refuse to authenticate.
    const tampered = { ...sealed, tag: sealed.tag.replace(/^../, 'ff') };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('returns null instead of throwing from safeDecryptSecret', () => {
    const sealed = encryptSecret('value');
    expect(safeDecryptSecret({ ...sealed, encryptedKey: 'not-base64!!' })).toBeNull();
  });

  it('round-trips the packed wire format', () => {
    const packed = encryptSecretString('wire-format-value');
    expect(packed.startsWith('v1.')).toBe(true);
    expect(decryptSecretString(packed)).toBe('wire-format-value');
  });

  it('reports configuration state', () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  describe('maskKey', () => {
    it('shows a recognisable prefix, an ellipsis and the last four characters', () => {
      const masked = maskKey('sk-proj-1234567890abcdefghijklmnop');
      expect(masked).toBe('sk-…mnop');
      // Never enough to reconstruct the key.
      expect(masked).not.toContain('1234567890abcdefghijklmnop');
    });

    it('fully masks anything too short to show a partial prefix', () => {
      expect(maskKey('abc')).toBe('••••••••');
      expect(maskKey('12345678')).toBe('••••••••');
    });

    it('never renders a missing key as an empty cell', () => {
      expect(maskKey(null)).toBe('••••');
      expect(maskKey(undefined)).toBe('••••');
      expect(maskKey('')).toBe('••••');
    });

    it('trims whitespace before masking', () => {
      expect(maskKey('  sk-abcdefghijklmnop  ')).toBe('sk-…mnop');
    });
  });
});
