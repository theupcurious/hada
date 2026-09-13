import { createAdminClient } from "@/lib/supabase/server";

export interface RateLimitRule {
  /** Short identifier, becomes part of the counter key. */
  name: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in seconds (fixed window). */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
}

export const RATE_LIMITS = {
  chat: { name: "chat", limit: 40, windowSeconds: 600 },
  confirmAction: { name: "confirm", limit: 40, windowSeconds: 600 },
  attachmentExtract: { name: "extract", limit: 15, windowSeconds: 600 },
  telegramLink: { name: "tg-link", limit: 10, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Per-subject fixed-window limiter backed by the `check_rate_limit` Postgres
 * function (migration 024). Counts are shared across app instances.
 *
 * Availability over strictness: if the RPC is unavailable (migration not yet
 * applied, DB hiccup) the request is allowed and the failure is logged loudly.
 */
export async function checkRateLimit(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: `${rule.name}:${subject}`,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });

  if (error || !data) {
    console.error("rate limit check failed (allowing request):", rule.name, error?.message);
    return { allowed: true, remaining: rule.limit, resetAt: null };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; remaining: number; reset_at: string }
    | undefined;
  if (!row) {
    return { allowed: true, remaining: rule.limit, resetAt: null };
  }
  return { allowed: row.allowed, remaining: row.remaining, resetAt: new Date(row.reset_at) };
}

export function rateLimitedResponse(result: RateLimitResult): Response {
  const retryAfter = result.resetAt ? Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)) : 60;
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
    },
  });
}
