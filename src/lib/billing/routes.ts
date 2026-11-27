import type { SupabaseClient } from "@supabase/supabase-js";

/** Absolute app URL for Stripe redirects. Never derived from the request host. */
export function appUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : null;
}

export interface BillingProfile {
  email: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
}

/** Billing columns (migration 026). Kept out of the quota path on purpose. */
export async function loadBillingProfile(admin: SupabaseClient, userId: string): Promise<BillingProfile | null> {
  const { data, error } = await admin
    .from("users")
    .select("email, stripe_customer_id, subscription_status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load billing profile: ${error.message}`);
  return (data as BillingProfile | null) ?? null;
}

export const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
