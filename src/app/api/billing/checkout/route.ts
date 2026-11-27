import { NextRequest } from "next/server";
import { appUrl, jsonResponse, LIVE_SUBSCRIPTION_STATUSES, loadBillingProfile } from "@/lib/billing/routes";
import { createCheckoutSession, getBillingConfig, parsePaidPlan } from "@/lib/billing/stripe";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Start a Stripe Checkout session for a paid plan. Body: { plan: "paid" | "pro" }. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  // The client names a plan; the server maps it to a price. Never accept a price id.
  const plan = parsePaidPlan(body?.plan);
  if (!plan) return jsonResponse({ error: "Choose a plan to upgrade to." }, 400);

  const config = getBillingConfig();
  if (!config) return jsonResponse({ error: "Billing isn’t set up yet." }, 503);

  const successUrl = appUrl("/settings?tab=account&billing=success");
  const cancelUrl = appUrl("/settings?tab=account&billing=cancelled");
  if (!successUrl || !cancelUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set; cannot build Stripe redirect URLs");
    return jsonResponse({ error: "Billing isn’t set up yet." }, 503);
  }

  try {
    const admin = createAdminClient();
    const profile = await loadBillingProfile(admin, user.id);
    if (profile?.subscription_status && LIVE_SUBSCRIPTION_STATUSES.has(profile.subscription_status)) {
      return jsonResponse(
        { error: "You already have a subscription. Use Manage billing to change plans.", portal: true },
        409,
      );
    }

    const session = await createCheckoutSession(config, {
      plan,
      userId: user.id,
      email: profile?.email || user.email || "",
      customerId: profile?.stripe_customer_id,
      successUrl,
      cancelUrl,
    });
    return jsonResponse({ url: session.url }, 200);
  } catch (error) {
    console.error("Checkout session failed:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Couldn’t start checkout. Try again in a moment." }, 502);
  }
}
