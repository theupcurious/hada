import type { SupabaseClient } from "@supabase/supabase-js";
import {
  retrieveSubscription,
  subscriptionPeriodEnd,
  subscriptionPriceId,
  tierForSubscription,
  type BillingConfig,
} from "@/lib/billing/stripe";
import { normalizeTier } from "@/lib/usage/plans";

const TERMINAL_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

export type SyncResult =
  | { applied: true; userId: string; tier: string; status: string }
  | { applied: false; reason: "no_user" | "stale_subscription" };

/**
 * Re-fetch a subscription from Stripe (the source of truth, so out-of-order or
 * replayed webhooks are harmless) and write the user's tier and billing state.
 *
 * The user is found by the subscription's `metadata.user_id` (set at checkout),
 * then by stored customer id — never by email. Throws on Stripe/DB failures so
 * the webhook returns 5xx and Stripe retries.
 */
export async function syncSubscription(
  admin: SupabaseClient,
  config: BillingConfig,
  subscriptionId: string,
): Promise<SyncResult> {
  const subscription = await retrieveSubscription(config, subscriptionId);

  const user = await findUser(admin, subscription.metadata?.user_id, subscription.customer);
  if (!user) {
    console.error("Stripe subscription has no matching user:", subscription.id, subscription.customer);
    return { applied: false, reason: "no_user" };
  }

  // An old subscription ending must not downgrade a user who has since
  // subscribed again under a different subscription id.
  if (
    user.stripe_subscription_id &&
    user.stripe_subscription_id !== subscription.id &&
    TERMINAL_STATUSES.has(subscription.status)
  ) {
    return { applied: false, reason: "stale_subscription" };
  }

  const tier = tierForSubscription({
    status: subscription.status,
    priceId: subscriptionPriceId(subscription),
    prices: config.prices,
    currentTier: normalizeTier(user.tier),
  });

  const { error } = await admin
    .from("users")
    .update({
      tier,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      current_period_end: subscriptionPeriodEnd(subscription),
    })
    .eq("id", user.id);
  if (error) {
    throw new Error(`Failed to update billing state: ${error.message}`);
  }

  return { applied: true, userId: user.id, tier, status: subscription.status };
}

interface BillingUserRow {
  id: string;
  tier: string | null;
  stripe_subscription_id: string | null;
}

async function findUser(
  admin: SupabaseClient,
  metadataUserId: string | undefined,
  customerId: string,
): Promise<BillingUserRow | null> {
  const columns = "id, tier, stripe_subscription_id";

  if (metadataUserId) {
    const { data, error } = await admin.from("users").select(columns).eq("id", metadataUserId).maybeSingle();
    if (error) throw new Error(`Failed to load user: ${error.message}`);
    if (data) return data as BillingUserRow;
  }

  const { data, error } = await admin.from("users").select(columns).eq("stripe_customer_id", customerId).maybeSingle();
  if (error) throw new Error(`Failed to load user by customer: ${error.message}`);
  return (data as BillingUserRow | null) ?? null;
}
