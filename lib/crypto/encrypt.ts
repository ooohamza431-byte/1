import crypto from 'node:crypto';

/**
 * AES-256-GCM secret encryption.
 *
 * Every stored API key (user-owned and server-shared) is encrypted with its own
 * random 12-byte IV. The authentication tag is stored alongside the ciphertext,
 * so tampering with a stored key is detected at decrypt time rather than being
 * silently used.
 *
 * Stored shape (three base64 columns in Postgres):
 *   encryptedKey -> ciphertext
 *   iv           -> initialisation vector
 *   tag          -> GCM auth tag
 *
 * Wire format produced by `encryptSecretString` (single-column storage, used by
 * backups and the seed script): `v1.<iv>.<tag>.<ciphertext>`.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedSecret {
  encryptedKey: string;
  iv: string;
  tag: string;
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Resolve the master key. Accepts 64 hex chars (preferred, as produced by
 * `openssl rand -hex 32`) or a base64 string that decodes to 32 bytes.
 */
function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new EncryptionError(
      'ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to your environment.',
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === KEY_BYTES) return decoded;
  } catch {
    /* fall through to the error below */
  }

  throw new EncryptionError(
    'ENCRYPTION_KEY must be 64 hex characters (32 bytes) or a base64 string that decodes to 32 bytes.',
  );
}

/** True when a valid-looking master key is configured. Used for health checks. */
export function isEncryptionConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_BYTES).toString('hex');
}

/** Encrypt a plaintext key for three-column storage. */
export function encryptSecret(plaintext: string): EncryptedSecret {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new EncryptionError('Cannot encrypt an empty secret.');
  }
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedKey: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/** Decrypt a three-column secret. Throws `EncryptionError` on tamper/mis-key. */
export function decryptSecret({ encryptedKey, iv, tag }: EncryptedSecret): string {
  if (!encryptedKey || !iv || !tag) {
    throw new EncryptionError('Incomplete encrypted payload (missing ciphertext, iv or tag).');
  }
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  try {
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    throw new EncryptionError(
      'Failed to decrypt secret — the ENCRYPTION_KEY does not match the key used to store it, or the value was tampered with.',
    );
  }
}

/** Non-throwing decrypt for read paths that must degrade gracefully. */
export function safeDecryptSecret(payload: EncryptedSecret): string | null {
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

/**
 * Mask a key for display. The plaintext never reaches the browser; this is used
 * for admin tables and audit-log details.
 */
export function maskKey(key: string | null | undefined): string {
  if (!key) return '••••';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}…${suffix}`;
}

/* -------------------------------------------------------------------------- */
/*  Single-column wire format (backups / seed / export)                       */
/* -------------------------------------------------------------------------- */

export function encryptSecretString(plaintext: string): string {
  const { encryptedKey, iv, tag } = encryptSecret(plaintext);
  return `v1.${iv}.${tag}.${encryptedKey}`;
}

export function decryptSecretString(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new EncryptionError('Unrecognised secret wire format.');
  }
  const [, iv, tag, encryptedKey] = parts;
  return decryptSecret({ iv, tag, encryptedKey });
}

/**
 * Re-encrypt a value that is still encrypted under a previous master key while
 * rotating `ENCRYPTION_KEY`. Returns the new payload so a migration script can
 * persist it.
 */
export function rotateSecret(payload: EncryptedSecret, oldKeyHex: string): EncryptedSecret {
  const previous = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = oldKeyHex;
  let plaintext: string;
  try {
    plaintext = decryptSecret(payload);
  } finally {
    if (previous === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previous;
  }
  return encryptSecret(plaintext);
}

/** Constant-time comparison used by credential verification helpers. */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
