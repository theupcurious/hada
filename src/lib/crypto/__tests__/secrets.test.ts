import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return import("@/lib/crypto/secrets");
}

describe("secrets", () => {
  const original = process.env.INTEGRATION_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  afterEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = original;
  });

  it("round-trips and produces a fresh IV each time", async () => {
    const { encryptSecret, decryptSecret, isEncrypted } = await load();
    const a = encryptSecret("ya29.token");
    const b = encryptSecret("ya29.token");
    expect(a).not.toBe(b);
    expect(isEncrypted(a)).toBe(true);
    expect(decryptSecret(a)).toBe("ya29.token");
    expect(decryptSecret(b)).toBe("ya29.token");
  });

  it("passes legacy plaintext through decrypt", async () => {
    const { decryptSecret, isEncrypted } = await load();
    expect(isEncrypted("plain")).toBe(false);
    expect(decryptSecret("plain")).toBe("plain");
  });

  it("detects tampering", async () => {
    const { encryptSecret, decryptSecret } = await load();
    const enc = encryptSecret("secret");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A=") ? "B=" : "A=");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("refuses to encrypt without a key", async () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const { encryptSecret, isEncryptionConfigured } = await load();
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });
});
