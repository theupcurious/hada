import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/billing/routes";
import { getBillingConfig, verifyStripeSignature } from "@/lib/billing/stripe";
import { syncSubscription } from "@/lib/billing/sync";
import { createAdminClient } from "@/lib/supabase/server";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: { id?: string; object?: string; subscription?: string | null; mode?: string } };
}

/**
 * Stripe webhook. Verifies the signature against the raw body, then re-syncs
 * the affected subscription from Stripe. Returns 5xx on failure so Stripe
 * retries; re-syncing is idempotent, so retries and replays are safe.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const config = getBillingConfig();
  if (!secret || !config) {
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET / billing config is not set");
    return jsonResponse({ error: "Webhook not configured" }, 500);
  }

  const payload = await request.text();
  const verdict = verifyStripeSignature({
    payload,
    header: request.headers.get("stripe-signature"),
    secret,
  });
  if (verdict !== "ok") {
    return jsonResponse({ error: verdict === "stale" ? "Signature timestamp too old" : "Invalid signature" }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  const object = event.data?.object;
  let subscriptionId: string | null = null;
  if (event.type === "checkout.session.completed" && object?.mode === "subscription") {
    subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
  } else if (event.type && SUBSCRIPTION_EVENTS.has(event.type)) {
    subscriptionId = typeof object?.id === "string" ? object.id : null;
  }

  if (!subscriptionId) {
    return jsonResponse({ received: true, ignored: true }, 200);
  }

  try {
    const result = await syncSubscription(createAdminClient(), config, subscriptionId);
    return jsonResponse({ received: true, ...result }, 200);
  } catch (error) {
    console.error("Stripe webhook sync failed:", event.id, error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Sync failed" }, 500);
  }
}
