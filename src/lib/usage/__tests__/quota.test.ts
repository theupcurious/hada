import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeChatError } from "@/lib/chat/user-facing-error";
import {
  PLAN_LIMITS,
  QUOTA_EXCEEDED_PREFIX,
  currentPeriod,
  evaluateQuota,
  normalizeTier,
  stripQuotaPrefix,
} from "@/lib/usage/plans";
import { QuotaExceededError, assertWithinQuota, checkQuota } from "@/lib/usage/quota";

const resetsAt = new Date(Date.UTC(2026, 11, 1));
const usage = (runs: number, tokens = 0) => ({ runs, inputTokens: tokens, outputTokens: 0, costUsd: 0 });

describe("evaluateQuota", () => {
  it("allows under the message limit and denies at it", () => {
    const limit = PLAN_LIMITS.free.monthlyMessages;
    expect(evaluateQuota({ tier: "free", usage: usage(limit - 1), resetsAt })).toEqual({ allowed: true });

    const denied = evaluateQuota({ tier: "free", usage: usage(limit), resetsAt });
    expect(denied).toMatchObject({ allowed: false, reason: "messages" });
    if (!denied.allowed) {
      expect(denied.message.startsWith(QUOTA_EXCEEDED_PREFIX)).toBe(true);
      expect(denied.message).toContain("December 1");
    }
  });

  it("denies when the token safety cap is reached", () => {
    const decision = evaluateQuota({ tier: "paid", usage: usage(1, PLAN_LIMITS.paid.monthlyTokens), resetsAt });
    expect(decision).toMatchObject({ allowed: false, reason: "tokens" });
  });

  it("uses the higher plan's limits", () => {
    expect(evaluateQuota({ tier: "pro", usage: usage(PLAN_LIMITS.free.monthlyMessages), resetsAt }).allowed).toBe(true);
  });

  it("fails closed when usage is unknown", () => {
    expect(evaluateQuota({ tier: "pro", usage: null, resetsAt })).toMatchObject({ allowed: false, reason: "unavailable" });
  });

  it("exempts admins even when usage is unknown", () => {
    expect(evaluateQuota({ tier: "free", usage: null, exempt: true, resetsAt })).toEqual({ allowed: true });
  });

  it("treats unknown tiers as free", () => {
    expect(normalizeTier("enterprise")).toBe("free");
    expect(normalizeTier(undefined)).toBe("free");
    const decision = evaluateQuota({ tier: "enterprise", usage: usage(PLAN_LIMITS.free.monthlyMessages), resetsAt });
    expect(decision.allowed).toBe(false);
  });

  it("uses UTC calendar months", () => {
    const { start, resetsAt: end } = currentPeriod(new Date("2026-11-26T23:30:00Z"));
    expect(start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("quota error wording", () => {
  it("is not mistaken for a provider usage limit", () => {
    const decision = evaluateQuota({ tier: "free", usage: usage(PLAN_LIMITS.free.monthlyMessages), resetsAt });
    if (decision.allowed) throw new Error("expected denial");
    const described = describeChatError(decision.message);
    expect(described.plan).toBe(true);
    expect(described.title).not.toMatch(/provider/i);
    expect(described.message).toBe(stripQuotaPrefix(decision.message));
  });
});

function fakeSupabase(options: {
  profile?: { tier?: string; email?: string } | null;
  profileError?: string;
  summary?: Record<string, unknown>;
  summaryError?: string;
}): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.profile ?? null,
            error: options.profileError ? { message: options.profileError } : null,
          }),
        }),
      }),
    }),
    rpc: async () => ({
      data: options.summary ? [options.summary] : null,
      error: options.summaryError ? { message: options.summaryError } : null,
    }),
  } as unknown as SupabaseClient;
}

describe("checkQuota", () => {
  const originalAdmins = process.env.ADMIN_USER_EMAILS;

  afterEach(() => {
    process.env.ADMIN_USER_EMAILS = originalAdmins;
    vi.restoreAllMocks();
  });

  it("denies when the usage RPC errors (e.g. migration not applied)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = fakeSupabase({ profile: { tier: "pro" }, summaryError: "function does not exist" });
    await expect(checkQuota("u1", supabase)).resolves.toMatchObject({ allowed: false, reason: "unavailable" });
    await expect(assertWithinQuota("u1", supabase)).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("reads string totals from the RPC and allows under the limit", async () => {
    const supabase = fakeSupabase({
      profile: { tier: "free", email: "someone@example.com" },
      summary: { runs: "3", input_tokens: "1000", output_tokens: "200", cost_usd: "0.01" },
    });
    await expect(checkQuota("u1", supabase)).resolves.toEqual({ allowed: true });
  });

  it("lets admins through when usage can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.ADMIN_USER_EMAILS = "owner@example.com";
    const supabase = fakeSupabase({ profile: { tier: "free", email: "owner@example.com" }, summaryError: "boom" });
    await expect(checkQuota("u1", supabase)).resolves.toEqual({ allowed: true });
  });
});
