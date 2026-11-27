import { appUrl, jsonResponse, loadBillingProfile } from "@/lib/billing/routes";
import { createPortalSession, getBillingConfig } from "@/lib/billing/stripe";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Open the Stripe Customer Portal (change plan, payment method, invoices, cancel). */
export async function POST() {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const config = getBillingConfig();
  const returnUrl = appUrl("/settings?tab=account");
  if (!config || !returnUrl) return jsonResponse({ error: "Billing isn’t set up yet." }, 503);

  try {
    const profile = await loadBillingProfile(createAdminClient(), user.id);
    if (!profile?.stripe_customer_id) {
      return jsonResponse({ error: "There’s no billing account yet. Choose a plan first." }, 400);
    }
    const session = await createPortalSession(config, { customerId: profile.stripe_customer_id, returnUrl });
    return jsonResponse({ url: session.url }, 200);
  } catch (error) {
    console.error("Portal session failed:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Couldn’t open billing. Try again in a moment." }, 502);
  }
}
