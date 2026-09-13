import { describe, expect, it } from "vitest";
import { verifySharedSecret } from "@/lib/auth/shared-secret";

describe("verifySharedSecret", () => {
  it("fails closed when nothing is configured", () => {
    expect(verifySharedSecret(undefined, "abc")).toBe("not_configured");
    expect(verifySharedSecret("", "abc")).toBe("not_configured");
    expect(verifySharedSecret("  ", undefined)).toBe("not_configured");
  });
  it("rejects missing, wrong, and different-length secrets", () => {
    expect(verifySharedSecret("s3cret", null)).toBe("unauthorized");
    expect(verifySharedSecret("s3cret", "s3cres")).toBe("unauthorized");
    expect(verifySharedSecret("s3cret", "s3cret!")).toBe("unauthorized");
  });
  it("accepts an exact match", () => {
    expect(verifySharedSecret("s3cret", "s3cret")).toBe("ok");
  });
});
