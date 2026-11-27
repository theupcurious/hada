import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserTier } from "@/lib/types/database";

/**
 * Minimal Stripe client: form-encoded REST calls and webhook signature checks,
 * no SDK. API calls pin a Stripe-Version so response shapes don't shift when
 * the account's default version changes.
 */

export const STRIPE_API_VERSION = "2025-03-31.basil";
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Plans a user can buy. Keys match users.tier. */
export type PaidPlan = Extract<UserTier, "paid" | "pro">;

export interface BillingConfig {
  secretKey: string;
  prices: Record<PaidPlan, string>;
}

/** Null unless the secret key and both price ids are set. */
export function getBillingConfig(): BillingConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const plus = process.env.STRIPE_PRICE_PLUS?.trim();
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  if (!secretKey || !plus || !pro) return null;
  return { secretKey, prices: { paid: plus, pro } };
}

export function isBillingEnabled(): boolean {
  return getBillingConfig() !== null;
}

export function parsePaidPlan(value: unknown): PaidPlan | null {
  return value === "paid" || value === "pro" ? value : null;
}

// ─── Form encoding ────────────────────────────────────────────────────────────

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/** Encode nested params with Stripe's bracket notation: line_items[0][price]=… */
export function encodeStripeForm(params: Record<string, FormValue>): string {
  const pairs: string[] = [];
  const walk = (key: string, value: FormValue) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(`${key}[${index}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [child, childValue] of Object.entries(value)) walk(`${key}[${child}]`, childValue);
      return;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [key, value] of Object.entries(params)) walk(key, value);
  return pairs.join("&");
}

// ─── API calls ────────────────────────────────────────────────────────────────

export class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

async function stripeRequest<T>(
  config: BillingConfig,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, FormValue>,
): Promise<T> {
  const body = params ? encodeStripeForm(params) : undefined;
  const url = method === "GET" && body ? `${STRIPE_API_BASE}${path}?${body}` : `${STRIPE_API_BASE}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(method === "POST" && body ? { body } : {}),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!response.ok) {
    throw new StripeApiError(data.error?.message || `Stripe request failed (${response.status})`, response.status);
  }
  return data;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number }> };
}

export async function createCheckoutSession(
  config: BillingConfig,
  options: {
    plan: PaidPlan;
    userId: string;
    email: string;
    customerId?: string | null;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<{ url: string }> {
  const session = await stripeRequest<{ url?: string }>(config, "POST", "/checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: config.prices[options.plan], quantity: 1 }],
    client_reference_id: options.userId,
    subscription_data: { metadata: { user_id: options.userId } },
    metadata: { user_id: options.userId },
    ...(options.customerId ? { customer: options.customerId } : { customer_email: options.email }),
    allow_promotion_codes: true,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
  });
  if (!session.url) throw new StripeApiError("Stripe returned no checkout URL", 502);
  return { url: session.url };
}

export async function createPortalSession(
  config: BillingConfig,
  options: { customerId: string; returnUrl: string },
): Promise<{ url: string }> {
  const session = await stripeRequest<{ url?: string }>(config, "POST", "/billing_portal/sessions", {
    customer: options.customerId,
    return_url: options.returnUrl,
  });
  if (!session.url) throw new StripeApiError("Stripe returned no portal URL", 502);
  return { url: session.url };
}

export async function retrieveSubscription(config: BillingConfig, subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(config, "GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export type SignatureVerdict = "ok" | "invalid" | "stale";

/**
 * Verify a `Stripe-Signature` header (`t=…,v1=…[,v1=…]`) against the raw body.
 * Any v1 may match (Stripe sends several while a secret is being rolled).
 */
export function verifyStripeSignature(options: {
  payload: string;
  header: string | null;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): SignatureVerdict {
  if (!options.header) return "invalid";

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of options.header.split(",")) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim());
    if (!key || !value) continue;
    if (key === "t") timestamp = Number(value);
    if (key === "v1") signatures.push(value);
  }
  if (timestamp === null || !Number.isFinite(timestamp) || !signatures.length) return "invalid";

  const expected = createHmac("sha256", options.secret).update(`${timestamp}.${options.payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const matched = signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
  if (!matched) return "invalid";

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  return Math.abs(now - timestamp) > tolerance ? "stale" : "ok";
}

// ─── Subscription → tier ──────────────────────────────────────────────────────

/**
 * Decide a user's tier from their subscription.
 * - active / trialing → the plan the price maps to
 * - past_due → keep the current tier while Stripe retries the payment
 * - incomplete → no upgrade until the first payment succeeds
 * - canceled / unpaid / incomplete_expired / paused / unknown → free
 * An unrecognised price maps to free.
 */
export function tierForSubscription(options: {
  status: string;
  priceId: string | null | undefined;
  prices: Record<PaidPlan, string>;
  currentTier: UserTier;
}): UserTier {
  const planForPrice = (Object.entries(options.prices) as Array<[PaidPlan, string]>).find(
    ([, price]) => price === options.priceId,
  )?.[0];

  switch (options.status) {
    case "active":
    case "trialing":
      if (!planForPrice) {
        console.error("Stripe subscription has an unrecognised price; treating as free:", options.priceId);
        return "free";
      }
      return planForPrice;
    case "past_due":
    case "incomplete":
      return options.currentTier;
    default:
      return "free";
  }
}

export function subscriptionPriceId(subscription: StripeSubscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

/** Period end moved onto subscription items in newer API versions; read both. */
export function subscriptionPeriodEnd(subscription: StripeSubscription): string | null {
  const seconds = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}
