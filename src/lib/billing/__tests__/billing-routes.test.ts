import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({ user: { id: "u1", email: "u1@example.com" }, error: null })),
}));
const syncSubscription = vi.fn(async () => ({ applied: true, userId: "u1", tier: "paid", status: "active" }));
vi.mock("@/lib/billing/sync", () => ({ syncSubscription: (...args: unknown[]) => syncSubscription(...(args as [])) }));

const ENV_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_PLUS", "STRIPE_PRICE_PRO", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_APP_URL"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_PRICE_PLUS: "price_plus",
    STRIPE_PRICE_PRO: "price_pro",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
  });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.clearAllMocks();
});

function post(url: string, body: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: "POST", body, headers: { "Content-Type": "application/json", ...headers } });
}

describe("checkout route", () => {
  it("refuses an unknown plan, including a raw price id", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const plan of ["enterprise", "price_pro", undefined]) {
      const response = await POST(post("http://localhost/api/billing/checkout", JSON.stringify({ plan })));
      expect(response.status).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 503 when billing isn't configured", async () => {
    delete process.env.STRIPE_PRICE_PRO;
    const { POST } = await import("@/app/api/billing/checkout/route");
    const response = await POST(post("http://localhost/api/billing/checkout", JSON.stringify({ plan: "paid" })));
    expect(response.status).toBe(503);
  });
});

describe("stripe webhook route", () => {
  const sign = (payload: string, t = Math.floor(Date.now() / 1000)) =>
    `t=${t},v1=${createHmac("sha256", "whsec_x").update(`${t}.${payload}`).digest("hex")}`;

  it("rejects an unsigned request without syncing", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(post("http://localhost/api/webhooks/stripe", "{}"));
    expect(response.status).toBe(400);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("refuses with 500 when the webhook secret is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(post("http://localhost/api/webhooks/stripe", "{}"));
    expect(response.status).toBe(500);
  });

  it("syncs the subscription named by a checkout or subscription event", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const checkout = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", mode: "subscription", subscription: "sub_1" } },
    });
    expect((await POST(post("http://localhost/x", checkout, { "stripe-signature": sign(checkout) }))).status).toBe(200);

    const updated = JSON.stringify({ type: "customer.subscription.deleted", data: { object: { id: "sub_2" } } });
    expect((await POST(post("http://localhost/x", updated, { "stripe-signature": sign(updated) }))).status).toBe(200);

    expect(syncSubscription.mock.calls.map((call) => (call as unknown[])[2])).toEqual(["sub_1", "sub_2"]);
  });

  it("acknowledges unrelated events without syncing", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const other = JSON.stringify({ type: "invoice.paid", data: { object: { id: "in_1" } } });
    const response = await POST(post("http://localhost/x", other, { "stripe-signature": sign(other) }));
    expect(response.status).toBe(200);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("returns 500 when sync fails so Stripe retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    syncSubscription.mockRejectedValueOnce(new Error("db down"));
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const event = JSON.stringify({ type: "customer.subscription.updated", data: { object: { id: "sub_3" } } });
    const response = await POST(post("http://localhost/x", event, { "stripe-signature": sign(event) }));
    expect(response.status).toBe(500);
  });
});
