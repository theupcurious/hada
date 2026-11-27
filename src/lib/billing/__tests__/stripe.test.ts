import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  encodeStripeForm,
  subscriptionPeriodEnd,
  tierForSubscription,
  verifyStripeSignature,
  type BillingConfig,
} from "@/lib/billing/stripe";
import { syncSubscription } from "@/lib/billing/sync";

const secret = "whsec_test";
const sign = (payload: string, t: number, key = secret) =>
  createHmac("sha256", key).update(`${t}.${payload}`).digest("hex");

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
  const now = 1_800_000_000;

  it("accepts a valid signature", () => {
    const header = `t=${now},v1=${sign(payload, now)}`;
    expect(verifyStripeSignature({ payload, header, secret, nowSeconds: now })).toBe("ok");
  });

  it("accepts when any of several v1 signatures matches", () => {
    const header = `t=${now},v1=${sign(payload, now, "old_secret")},v1=${sign(payload, now)}`;
    expect(verifyStripeSignature({ payload, header, secret, nowSeconds: now })).toBe("ok");
  });

  it("rejects a tampered body", () => {
    const header = `t=${now},v1=${sign(payload, now)}`;
    expect(verifyStripeSignature({ payload: payload + " ", header, secret, nowSeconds: now })).toBe("invalid");
  });

  it("rejects a stale timestamp", () => {
    const t = now - 301;
    const header = `t=${t},v1=${sign(payload, t)}`;
    expect(verifyStripeSignature({ payload, header, secret, nowSeconds: now })).toBe("stale");
  });

  it("rejects missing or malformed headers", () => {
    expect(verifyStripeSignature({ payload, header: null, secret })).toBe("invalid");
    expect(verifyStripeSignature({ payload, header: "t=abc", secret })).toBe("invalid");
    expect(verifyStripeSignature({ payload, header: `t=${now},v1=short`, secret, nowSeconds: now })).toBe("invalid");
  });
});

describe("encodeStripeForm", () => {
  it("uses bracket notation for nested params and skips empty values", () => {
    const encoded = encodeStripeForm({
      mode: "subscription",
      line_items: [{ price: "price_123", quantity: 1 }],
      subscription_data: { metadata: { user_id: "u 1" } },
      customer: undefined,
      allow_promotion_codes: true,
    });
    expect(decodeURIComponent(encoded)).toBe(
      "mode=subscription&line_items[0][price]=price_123&line_items[0][quantity]=1" +
        "&subscription_data[metadata][user_id]=u 1&allow_promotion_codes=true",
    );
  });
});

describe("tierForSubscription", () => {
  const prices = { paid: "price_plus", pro: "price_pro" };
  const cases: Array<[string, string | null, "free" | "paid" | "pro", "free" | "paid" | "pro"]> = [
    ["active", "price_plus", "free", "paid"],
    ["trialing", "price_pro", "free", "pro"],
    ["past_due", "price_pro", "pro", "pro"],
    ["incomplete", "price_pro", "free", "free"],
    ["canceled", "price_pro", "pro", "free"],
    ["unpaid", "price_plus", "paid", "free"],
    ["incomplete_expired", "price_plus", "free", "free"],
  ];

  it.each(cases)("%s with %s (currently %s) → %s", (status, priceId, currentTier, expected) => {
    expect(tierForSubscription({ status, priceId, prices, currentTier })).toBe(expected);
  });

  it("maps an unknown price to free", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(tierForSubscription({ status: "active", priceId: "price_other", prices, currentTier: "pro" })).toBe("free");
  });

  it("reads the period end from items or the subscription", () => {
    expect(subscriptionPeriodEnd({ id: "s", customer: "c", status: "active", items: { data: [{ current_period_end: 0 }] } }))
      .toBe("1970-01-01T00:00:00.000Z");
    expect(subscriptionPeriodEnd({ id: "s", customer: "c", status: "active", current_period_end: 86_400 }))
      .toBe("1970-01-02T00:00:00.000Z");
  });
});

describe("syncSubscription", () => {
  const config: BillingConfig = { secretKey: "sk_test", prices: { paid: "price_plus", pro: "price_pro" } };

  afterEach(() => vi.restoreAllMocks());

  function fakeAdmin(user: Record<string, unknown> | null) {
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
    const admin = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: user, error: null }) }) }),
        update,
      }),
    } as unknown as SupabaseClient;
    return { admin, update };
  }

  function mockSubscription(sub: Record<string, unknown>) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(sub), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
  }

  it("re-fetches the subscription and writes the tier", async () => {
    const fetchSpy = mockSubscription({
      id: "sub_1", customer: "cus_1", status: "active", metadata: { user_id: "u1" },
      items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_800_000_000 }] },
    });
    const { admin, update } = fakeAdmin({ id: "u1", tier: "free", stripe_subscription_id: null });

    await expect(syncSubscription(admin, config, "sub_1")).resolves.toMatchObject({ applied: true, tier: "pro" });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/subscriptions/sub_1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      tier: "pro", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", subscription_status: "active",
    }));
  });

  it("ignores an old subscription ending after the user resubscribed", async () => {
    mockSubscription({ id: "sub_old", customer: "cus_1", status: "canceled", metadata: { user_id: "u1" } });
    const { admin, update } = fakeAdmin({ id: "u1", tier: "pro", stripe_subscription_id: "sub_new" });

    await expect(syncSubscription(admin, config, "sub_old")).resolves.toEqual({ applied: false, reason: "stale_subscription" });
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when Stripe errors so the webhook returns 5xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "down" } }), { status: 500 }));
    const { admin } = fakeAdmin(null);
    await expect(syncSubscription(admin, config, "sub_1")).rejects.toThrow("down");
  });
});
