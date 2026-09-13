import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets at rest (OAuth refresh/access tokens).
 *
 * Key: `INTEGRATION_ENCRYPTION_KEY` — 32 bytes as base64 or hex. Generate with
 *   openssl rand -base64 32
 *
 * Ciphertext format: `enc:v1:<base64 iv>:<base64 tag>:<base64 data>` so it is
 * self-describing and legacy plaintext rows can be told apart and migrated.
 */

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

let cachedKey: Buffer | null | undefined;

function loadKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  const decoded = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex)");
  }
  cachedKey = decoded;
  return cachedKey;
}

export function isEncryptionConfigured(): boolean {
  return loadKey() !== null;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  if (!key) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not set; refusing to store secret in plaintext");
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

/**
 * Decrypts an `enc:v1:` value. Values without the prefix are returned as-is so
 * rows written before encryption was enabled keep working; callers should
 * re-encrypt those opportunistically (see `google/tokens.ts`).
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = loadKey();
  if (!key) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not set but an encrypted secret was found");
  }
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
