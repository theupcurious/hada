import { timingSafeEqual } from "node:crypto";

/**
 * Compare a request-supplied secret against the configured one.
 *
 * Fails closed: an unset/empty configured secret is treated as "not
 * configured" (status 500) rather than "no auth required". Uses a
 * constant-time comparison so the header can't be brute-forced byte by byte.
 */
export function verifySharedSecret(
  configured: string | undefined,
  supplied: string | null | undefined,
): "ok" | "unauthorized" | "not_configured" {
  if (!configured || !configured.trim()) {
    return "not_configured";
  }
  if (!supplied) {
    return "unauthorized";
  }
  const a = Buffer.from(configured);
  const b = Buffer.from(supplied);
  if (a.length !== b.length) {
    return "unauthorized";
  }
  return timingSafeEqual(a, b) ? "ok" : "unauthorized";
}
