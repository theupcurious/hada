import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard for model-driven outbound requests (web_fetch, mcp_call).
 *
 * Rejects non-HTTP(S) schemes, credentials in the URL, and any hostname that
 * resolves — via DNS, so string blocklists can't be bypassed — to a loopback,
 * link-local (cloud metadata), private, or otherwise non-public address.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const MAX_REDIRECTS = 5;

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("invalid URL");
  }

  if (!/^https?:$/i.test(url.protocol)) {
    throw new UnsafeUrlError("only HTTP(S) URLs are allowed");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new UnsafeUrlError("host is not publicly routable");
  }

  const addresses: string[] = [];
  if (isIP(hostname)) {
    addresses.push(hostname);
  } else {
    try {
      const resolved = await lookup(hostname, { all: true, verbatim: true });
      for (const entry of resolved) addresses.push(entry.address);
    } catch {
      throw new UnsafeUrlError("host could not be resolved");
    }
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("host could not be resolved");
  }
  // Reject if *any* record is private — DNS rebinding and round-robin tricks
  // would otherwise let one public A record smuggle a private one through.
  for (const address of addresses) {
    if (!isPublicAddress(address)) {
      throw new UnsafeUrlError("host is not publicly routable");
    }
  }

  return url;
}

/**
 * `fetch` that re-validates every redirect hop against `assertPublicUrl`.
 * A public URL that 302s to an internal address is the classic SSRF bypass.
 */
export async function fetchPublicUrl(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current.toString(), { ...init, redirect: "manual" });

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop === MAX_REDIRECTS) {
        throw new UnsafeUrlError("too many redirects");
      }
      // Drain the body so the connection can be reused.
      await response.body?.cancel().catch(() => undefined);
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    return response;
  }

  throw new UnsafeUrlError("too many redirects");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIPv4(address);
  if (family === 6) return isPublicIPv6(address);
  return false;
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return false; // 0.0.0.0/8 "this network"
  if (a === 10) return false; // 10/8 private
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16/12 private
  if (a === 192 && b === 168) return false; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64/10
  if (a === 192 && b === 0 && parts[2] === 0) return false; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a >= 224) return false; // multicast + reserved + broadcast
  return true;
}

function isPublicIPv6(address: string): boolean {
  const lower = address.toLowerCase().split("%")[0];
  // IPv4-mapped (::ffff:a.b.c.d) — judge by the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIPv4(mapped[1]);
  if (lower === "::" || lower === "::1") return false;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return false; // link-local fe80::/10
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false; // ULA fc00::/7
  if (lower.startsWith("ff")) return false; // multicast
  if (lower.startsWith("2001:db8")) return false; // documentation
  if (lower.startsWith("64:ff9b:")) return false; // NAT64 — could map to private v4
  return true;
}
