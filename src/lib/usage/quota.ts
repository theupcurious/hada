import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/server";
import type { UserTier } from "@/lib/types/database";
import {
  PLAN_LIMITS,
  currentPeriod,
  evaluateQuota,
  normalizeTier,
  type PlanLimits,
  type QuotaDecision,
  type QuotaDenialReason,
  type UsageTotals,
} from "@/lib/usage/plans";

/**
 * Server-side quota checks. `processMessage` calls `assertWithinQuota` before
 * any model call, so every entry point (web, Telegram, workflows, background
 * jobs) is covered; routes may pre-check to return a clean response.
 *
 * Fails closed: if usage can't be read (migration 025 missing, DB error), the
 * request is refused. Admins (ADMIN_USER_EMAILS) are exempt so the operator
 * can't be locked out.
 */

export class QuotaExceededError extends Error {
  readonly code = "quota_exceeded";
  constructor(
    message: string,
    readonly reason: QuotaDenialReason,
  ) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export interface UsageStatus {
  tier: UserTier;
  limits: PlanLimits;
  exempt: boolean;
  usage: UsageTotals | null;
  periodStart: string;
  resetsAt: string;
}

export async function getUsageStatus(userId: string, supabase?: SupabaseClient): Promise<UsageStatus> {
  const admin = supabase ?? createAdminClient();
  const { start, resetsAt } = currentPeriod();

  const [profileResult, usageResult] = await Promise.all([
    admin.from("users").select("tier, email").eq("id", userId).maybeSingle(),
    admin.rpc("get_usage_summary", { p_user_id: userId, p_since: start.toISOString() }),
  ]);

  const profile = profileResult.data as { tier?: unknown; email?: string | null } | null;
  if (profileResult.error) {
    console.error("Quota: failed to load user tier:", profileResult.error.message);
  }
  if (usageResult.error) {
    console.error("Quota: failed to load usage summary:", usageResult.error.message);
  }

  const tier = normalizeTier(profile?.tier);
  return {
    tier,
    limits: PLAN_LIMITS[tier],
    exempt: isAdminEmail(profile?.email),
    // A failed tier lookup also counts as "unknown usage" so we fail closed
    // rather than silently treating a paying user's request as Free (or worse).
    usage: profileResult.error || usageResult.error ? null : toTotals(usageResult.data),
    periodStart: start.toISOString(),
    resetsAt: resetsAt.toISOString(),
  };
}

export async function checkQuota(userId: string, supabase?: SupabaseClient): Promise<QuotaDecision> {
  try {
    const status = await getUsageStatus(userId, supabase);
    return evaluateQuota({
      tier: status.tier,
      usage: status.usage,
      exempt: status.exempt,
      resetsAt: new Date(status.resetsAt),
    });
  } catch (error) {
    console.error("Quota check failed:", error instanceof Error ? error.message : error);
    return evaluateQuota({ tier: "free", usage: null, resetsAt: currentPeriod().resetsAt });
  }
}

export async function assertWithinQuota(userId: string, supabase?: SupabaseClient): Promise<void> {
  const decision = await checkQuota(userId, supabase);
  if (!decision.allowed) {
    throw new QuotaExceededError(decision.message, decision.reason);
  }
}

export function isQuotaExceededError(error: unknown): error is QuotaExceededError {
  return error instanceof QuotaExceededError;
}

/**
 * Whether the user may have one more enabled workflow. `excludeTaskId` skips a
 * task that is being re-enabled so it isn't counted against itself. Existing
 * workflows over the cap (e.g. after a downgrade) are left running; the message
 * and token quota still bounds their cost.
 */
export async function checkWorkflowCap(
  userId: string,
  options: { supabase?: SupabaseClient; excludeTaskId?: string } = {},
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const admin = options.supabase ?? createAdminClient();
  try {
    const [{ data: profile, error: profileError }, countResult] = await Promise.all([
      admin.from("users").select("tier, email").eq("id", userId).maybeSingle(),
      (() => {
        let query = admin
          .from("scheduled_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("enabled", true);
        if (options.excludeTaskId) query = query.neq("id", options.excludeTaskId);
        return query;
      })(),
    ]);

    if (profileError || countResult.error) {
      throw new Error(profileError?.message ?? countResult.error?.message);
    }

    const row = profile as { tier?: unknown; email?: string | null } | null;
    if (isAdminEmail(row?.email)) return { allowed: true };

    const limits = PLAN_LIMITS[normalizeTier(row?.tier)];
    if ((countResult.count ?? 0) >= limits.activeWorkflows) {
      const noun = limits.activeWorkflows === 1 ? "workflow" : "workflows";
      return {
        allowed: false,
        message: `The ${limits.label} plan includes ${limits.activeWorkflows} active ${noun}. Pause or delete one to turn this on.`,
      };
    }
    return { allowed: true };
  } catch (error) {
    console.error("Workflow cap check failed:", error instanceof Error ? error.message : error);
    return { allowed: false, message: "Hada couldn’t check your plan’s workflow limit. Try again in a moment." };
  }
}

function toTotals(data: unknown): UsageTotals {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  return {
    runs: toNumber(row?.runs),
    inputTokens: toNumber(row?.input_tokens),
    outputTokens: toNumber(row?.output_tokens),
    costUsd: toNumber(row?.cost_usd),
  };
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}
